import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { promisify } from "node:util";
import z from "zod";
import { SidecarConfig } from "../../../lib/sidecar/config.ts";
import type { Started } from "../../../shared/types/assistant.ts";
import { Projects } from "../projects.ts";
import { TaskLane } from "../tasks/lane.ts";
import { claudeBinary } from "./jobs.ts";

export interface StartInput {
  text: string;
  slug?: string;
}

const START_MS = 30_000;

const run = promisify(execFile);

const Settings = z.object({
  agent: z.string().min(1).default("executive-assistant"),
  project: z.string().min(1).default("meta"),
});

const settings = (): z.infer<typeof Settings> => {
  const parsed = Settings.safeParse(SidecarConfig.read().assistant ?? {});
  return parsed.success ? parsed.data : Settings.parse({});
};

// What relay --new runs: inherited CLAUDE* variables would make the new session a child of the sidecar's own.
const start = async ({ text, slug }: StartInput): Promise<Started> => {
  const { agent, project } = settings();
  const home = Projects.list().find((one) => one.key === project);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("CLAUDE")));
  const prompt = slug ? `While reading the task ${slug}:\n\n${text}` : text;
  const ran = await run(claudeBinary(), ["--bg", "--agent", agent, prompt], {
    cwd: home?.folder ?? homedir(),
    env,
    timeout: START_MS,
  }).catch((error: Error & { stderr?: string }) => ({ failed: (error.stderr || error.message).trim() }));
  if ("failed" in ran) return { started: false, reason: ran.failed };
  const [key] = ran.stdout.replace(/\x1b\[[0-9;]*m/g, "").match(/\b[0-9a-f]{8}\b/) ?? [];
  if (slug)
    TaskLane.heard({ caller: { who: "YOU", from: `[${home?.token ?? project}] EA` }, kind: "message", text, slug });
  return { started: true, ...(key ? { key } : {}) };
};

export const Assistant = { start };
