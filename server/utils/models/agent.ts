import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { claudeBinary } from "../sessions/jobs";

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 60_000;

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AgentRun {
  prompt: string;
  system: string;
  addDirs?: string[];
  cwd?: string;
  effort?: Effort;
  maxTurns?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  tools?: string[];
}

type Result = { type?: string; subtype?: string; is_error?: boolean; result?: unknown };
type Failure = Error & { code?: unknown; killed?: boolean; stderr?: string; stdout?: string };

function resultOf(stdout: string): Result {
  try {
    const parsed = JSON.parse(stdout) as Result | Result[];
    // With no setting sources the CLI prints every event as an array, so the answer is its result event.
    return (Array.isArray(parsed) ? parsed.findLast((event) => event.type === "result") : parsed) ?? {};
  } catch {
    return {};
  }
}

// Safe mode and not --bare, which skips the keychain and so needs an API key: the blank run stays on Claude Code's own login.
async function run({
  model,
  prompt,
  system,
  addDirs = [],
  cwd = tmpdir(),
  effort,
  maxTurns,
  signal,
  timeoutMs = TIMEOUT_MS,
  tools = [],
}: AgentRun & { model: string }): Promise<string> {
  const pending = execFileAsync(
    claudeBinary(),
    [
      "-p",
      "--safe-mode",
      "--model",
      model,
      ...(effort ? ["--effort", effort] : []),
      "--tools",
      tools.join(","),
      ...(maxTurns ? ["--max-turns", String(maxTurns)] : []),
      ...addDirs.flatMap((dir) => ["--add-dir", dir]),
      "--setting-sources",
      "",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--strict-mcp-config",
      "--settings",
      JSON.stringify({ disableAllHooks: true }),
      "--system-prompt",
      system,
      "--output-format",
      "json",
    ],
    { cwd, maxBuffer: 16 * 1024 * 1024, signal, timeout: timeoutMs },
  );
  pending.child.stdin?.end(prompt);
  // A failed run still prints its result event, which carries the reason, such as not being logged in.
  const { stderr, stdout } = await pending.catch((error: Failure) => {
    if (signal?.aborted) throw new Error("Cancelled before Claude answered");
    if (error.code === "ENOENT") throw new Error("Claude Code is not installed");
    if (error.killed) throw new Error(`Claude Code took longer than ${timeoutMs / 1000}s`);
    return { stderr: error.stderr ?? "", stdout: error.stdout ?? "" };
  });
  const reply = resultOf(stdout);
  if (reply.subtype === "error_max_turns") throw new Error(`Claude stopped after ${maxTurns} turns without an answer`);
  if (reply.is_error || typeof reply.result !== "string") {
    // An older Claude Code rejects a flag on stderr and prints no result event at all.
    const said = typeof reply.result === "string" ? reply.result : stderr.trim().split("\n").at(-1);
    throw new Error(said || "Claude Code gave no answer");
  }
  return reply.result;
}

export const Agent = {
  haiku: (input: AgentRun): Promise<string> => run({ effort: "low", ...input, model: "haiku" }),
  sonnet: (input: AgentRun): Promise<string> => run({ ...input, model: "sonnet" }),
};
