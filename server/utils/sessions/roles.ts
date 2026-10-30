import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { SidecarConfig } from "../../../lib/sidecar/config.ts";
import { configRoot } from "../../../lib/sidecar/paths.ts";
import type { Role } from "../../../shared/types/task.ts";
import { claudeBinary, sessionEnv } from "./jobs.ts";

export interface Launch {
  agent: string;
  cwd: string;
  prompt: string;
  name?: string;
}

export type Launched = { key?: string } | { failed: string };

const START_MS = 30_000;
const AGENTS: Record<Role, string> = {
  EA: "executive-assistant",
  DL: "domain-lead",
  SL: "solution-lead",
  IC: "individual-contributor",
};

const run = promisify(execFile);

const agentOf = (role: Role): string => SidecarConfig.read().agents?.[role] || AGENTS[role];

const fileOf = (role: Role): string | undefined => {
  const path = join(configRoot(), "agents", `${agentOf(role)}.md`);
  return existsSync(path) ? path : undefined;
};

const launch = async ({ agent, cwd, prompt, name }: Launch): Promise<Launched> => {
  const args = ["--bg", "--agent", agent, ...(name ? ["--name", name] : []), prompt];
  const ran = await run(claudeBinary(), args, { cwd, env: sessionEnv(), timeout: START_MS }).catch(
    (error: Error & { stderr?: string }) => ({ failed: (error.stderr || error.message).trim() }),
  );
  if ("failed" in ran) return ran;
  const [key] = ran.stdout.replace(/\x1b\[[0-9;]*m/g, "").match(/\b[0-9a-f]{8}\b/) ?? [];
  return key ? { key } : {};
};

export const Roles = { agentOf, fileOf, launch };
