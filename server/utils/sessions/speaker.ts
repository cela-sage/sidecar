import { stripVTControlCharacters } from "node:util";
import { SlashCommand } from "../../../shared/utils/slash-command.ts";

export type SystemNote = { label: string };

// The queue records no origin, so the harness's own tag is the only thing telling system from typed.
const TAGS: [RegExp, (hit: RegExpMatchArray) => string][] = [
  [/<task-notification>[\s\S]*?<task-id>([^<]+)<\/task-id>/, (m) => `Task(${m[1]?.trim()})`],
  [/<task-notification>/, () => "Task notification"],
  [/<user-prompt-submit-hook>/, () => "Hook(UserPromptSubmit)"],
  [/<persisted-output>/, () => "Output persisted"],
];

// A skill writes its message tag before its name tag, so the two are read apart.
const COMMAND_NAME = /<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/;
const COMMAND_ARGS = /<command-args>([\s\S]*?)<\/command-args>/;
const PRINTED = /<local-command-std(?:out|err)>([\s\S]*?)<\/local-command-std(?:out|err)>/;

// Anywhere, not just at the start: an interruption sits between the withdrawn ask and the next one.
const INTERRUPT = /\[Request interrupted[^\]]*\]/g;

// A reminder wrapping a real message is context around it, not a message of its own.
const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

const CAVEAT = /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g;

export function noteOf(text: string): SystemNote | undefined {
  const body = text.trim();
  for (const [pattern, label] of TAGS) {
    const hit = body.match(pattern);
    if (hit) return { label: label(hit) };
  }
  const stripped = body.replace(REMINDER, "").trim();
  return stripped ? undefined : { label: "System reminder" };
}

export function withoutReminders(text: string): string {
  return text.replace(REMINDER, "").trim();
}

export type Piece =
  | { kind: "note"; label: string }
  | { kind: "said"; text: string }
  | { kind: "command"; line: string }
  | { kind: "printed"; text: string };

// The Compacted note stands in for the terminal's hint.
const COMPACTED_HINT = /^Compacted \(.+ to see full summary\)$/;
const HOOK_RECEIPT = /^(\w+) \[.*\] (completed successfully|failed)(?:: (.*))?$/;

const printedOf = (text: string): Piece[] => {
  const out: Piece[] = [];
  let block: string[] = [];
  const flush = (): void => {
    const kept = block.join("\n").trim();
    if (kept) out.push({ kind: "printed", text: kept });
    block = [];
  };
  for (const line of text.split("\n")) {
    if (COMPACTED_HINT.test(line)) continue;
    const hook = HOOK_RECEIPT.exec(line);
    if (!hook) {
      block.push(line);
      continue;
    }
    flush();
    const [, event, outcome, output = ""] = hook;
    out.push({ kind: "note", label: `Hook(${event})${outcome === "failed" ? " failed" : ""}` });
    if (output !== "{}") block.push(output);
  }
  flush();
  return out;
};

function ranOf(body: string): Piece[] | undefined {
  const name = COMMAND_NAME.exec(body)?.[1];
  const typed = name ? { name, args: COMMAND_ARGS.exec(body)?.[1] ?? "" } : SlashCommand.parse(body);
  const printed = PRINTED.exec(body);
  if (!typed && !printed) return undefined;
  return [
    ...(typed
      ? [{ kind: "command" as const, line: SlashCommand.line({ name: typed.name, args: typed.args.trim() }) }]
      : []),
    ...printedOf(stripVTControlCharacters(printed?.[1] ?? "")),
  ];
}

/** The message in order, so a withdrawn ask keeps its place ahead of the interruption. */
export function readOut(text: string): Piece[] {
  const unreminded = withoutReminders(text);
  if (!unreminded) return [{ kind: "note", label: "System reminder" }];

  const body = unreminded.replace(CAVEAT, "").trim();
  if (!body) return [];

  const ran = ranOf(body);
  if (ran) return ran;

  const note = noteOf(body);
  if (note) return [{ kind: "note", label: note.label }];

  const out: Piece[] = [];
  let last = 0;
  INTERRUPT.lastIndex = 0;
  for (let hit = INTERRUPT.exec(body); hit; hit = INTERRUPT.exec(body)) {
    const said = body.slice(last, hit.index).trim();
    if (said) out.push({ kind: "said", text: said });
    out.push({ kind: "note", label: "Interrupted" });
    last = hit.index + hit[0].length;
  }
  const rest = body.slice(last).trim();
  if (rest) out.push({ kind: "said", text: rest });
  return out;
}

const ARG_KEYS = [
  "file_path",
  "path",
  "pattern",
  "url",
  "skill",
  "command",
  "subject",
  "taskId",
  "query",
  "description",
];

// One argument per call, chosen rather than dumped: the point is to read the line, not audit it.
export function argOf(tool: string, input: unknown): string | undefined {
  if (typeof input !== "object" || !input) return undefined;
  const rec = input as Record<string, unknown>;
  // The question is the argument, and it is nested a level deeper than every other tool's.
  if (tool === "AskUserQuestion") return firstQuestion(rec);
  const preferred = tool === "Bash" ? ["description", "command"] : ARG_KEYS;
  for (const key of preferred) {
    const value = rec[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const one = value.trim().split("\n")[0] ?? "";
    return key === "file_path" || key === "path" ? shorten(one) : one;
  }
  return undefined;
}

function firstQuestion(rec: Record<string, unknown>): string | undefined {
  const { questions } = rec as { questions?: unknown };
  if (!Array.isArray(questions)) return undefined;
  for (const one of questions) {
    const asked = (one as Record<string, unknown>)?.question;
    if (typeof asked === "string" && asked.trim()) return asked.trim();
  }
  return undefined;
}

function shorten(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 2 ? parts.slice(-2).join("/") : parts.join("/") || path;
}
