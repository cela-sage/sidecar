#!/usr/bin/env -S node --experimental-strip-types
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const { WAKE_HOME = "", WAKE_LOG = "", WAKE_PID = "", WAKE_SOCKET = "", WAKE_AGENTS = "[]" } = process.env;

if (args[0] === "agents") {
  console.log(WAKE_AGENTS);
} else {
  const claudeVars = Object.keys(process.env).filter((name) => name.startsWith("CLAUDE"));
  appendFileSync(WAKE_LOG, `${JSON.stringify({ args, cwd: process.cwd(), claudeVars })}\n`);
  const sessions = join(WAKE_HOME, "sessions");
  const entry = { pid: Number(WAKE_PID), sessionId: args[2], cwd: process.cwd(), messagingSocketPath: WAKE_SOCKET };
  writeFileSync(join(sessions, `${WAKE_PID}.json`), JSON.stringify({ ...entry, updatedAt: Date.now() }));
  writeFileSync(join(sessions, `${WAKE_PID}.0a1b2c.key`), "token");
}
