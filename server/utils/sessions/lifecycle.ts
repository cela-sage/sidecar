import { setTimeout as sleep } from "node:timers/promises";
import { Refusal } from "../../../lib/sidecar/refusal.ts";
import type { Life, LifeChange } from "../../../shared/types/session.ts";
import { TurnBus } from "./busy.ts";
import { refreshJobs } from "./jobs.ts";
import { Lives } from "./life.ts";
import { isKey } from "./paths.ts";
import { stopSession } from "./removal.ts";
import { wake } from "./wake.ts";

const GONE_DEADLINE_MS = 5000;
const POLL_MS = 100;

const checked = (key: string, from: Life): void => {
  if (!isKey(key)) throw new Refusal("not a session key");
  if (Lives.ofKey(key) !== from) throw new Refusal(from === "alive" ? "already killed" : "already running");
};

const gone = async (key: string): Promise<boolean> => {
  for (const until = Date.now() + GONE_DEADLINE_MS; Date.now() < until; await sleep(POLL_MS)) {
    if (Lives.ofKey(key) === "killed") return true;
  }
  return false;
};

const kill = async (key: string): Promise<LifeChange> => {
  checked(key, "alive");
  const { refused } = await stopSession(key);
  if (refused) throw new Refusal(refused);
  await refreshJobs();
  if (!(await gone(key))) throw new Refusal("the process is still running");
  TurnBus.lived(key);
  return { key, life: "killed" };
};

const resume = async (key: string): Promise<LifeChange> => {
  checked(key, "killed");
  if (!(await wake(key))) throw new Refusal("the conversation did not resume");
  return { key, life: "alive" };
};

export const Lifecycle = { kill, resume };
