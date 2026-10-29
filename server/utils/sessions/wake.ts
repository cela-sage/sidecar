import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { liveSessions } from "./index.ts";
import { claudeBinary, sessionEnv } from "./jobs.ts";
import { entryOf, keyFileOf } from "./registry.ts";

const START_MS = 30_000;
const READY_MS = 15_000;
const POLL_MS = 200;

const run = promisify(execFile);
const waking = new Map<string, Promise<boolean>>();

const isReady = (key: string): boolean => {
  const entry = entryOf(key);
  return !!entry?.messagingSocketPath && !!keyFileOf(entry.pid);
};

const resume = async (key: string): Promise<boolean> => {
  const session = liveSessions({ scope: "live", key }).find((one) => one.key === key);
  if (!session) return false;
  await run(claudeBinary(), ["--bg", "--resume", session.id], {
    cwd: session.cwd,
    env: sessionEnv(),
    timeout: START_MS,
  });
  for (const until = Date.now() + READY_MS; !isReady(key) && Date.now() < until; ) await sleep(POLL_MS);
  return isReady(key);
};

// Resuming a session that already runs starts a copy under a new id, so concurrent wakes of a key share one resume.
export const wake = (key: string): Promise<boolean> => {
  const running = waking.get(key) ?? resume(key).finally(() => waking.delete(key));
  waking.set(key, running);
  return running;
};
