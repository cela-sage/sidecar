import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { read } from "../../../lib/sidecar/events.ts";
import type { SessionCommand } from "../../../shared/types/command.ts";
import { SessionCommands } from "./commands.ts";

let dir = "";
before(() => {
  dir = mkdtempSync(join(tmpdir(), "sidecar-commands-"));
  process.env.CLAUDE_CONFIG_DIR = dir;
  process.env.CLAUDE_BIN = join(dir, "no-such-claude");
  mkdirSync(join(dir, "sessions"));
});
after(() => {
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.CLAUDE_BIN;
  rmSync(dir, { recursive: true, force: true });
});

const listOf = (...names: string[]): SessionCommand[] =>
  names.map((name) => ({ name, description: "", source: "builtin" }));
const namesOf = (key: string): string[] => SessionCommands.held(key).map((one) => one.name);
const run = (key: string, cwd: string): void =>
  writeFileSync(
    join(dir, "sessions", `${key}.json`),
    JSON.stringify({ pid: process.pid, sessionId: `${key}-1111-2222-3333-444444444444`, cwd }),
  );

test("an answer is held for the next read, and announced only when the list changed", () => {
  assert.deepEqual(SessionCommands.held("aaaa0001"), []);
  SessionCommands.answer("aaaa0001", listOf("compact"));
  SessionCommands.answer("aaaa0001", listOf("compact"));
  SessionCommands.answer("aaaa0001", listOf("compact", "model"));

  assert.deepEqual(namesOf("aaaa0001"), ["compact", "model"]);
  assert.deepEqual(
    read().events.map((one) => [one.topic, one.data]),
    [
      ["commands.changed", { key: "aaaa0001" }],
      ["commands.changed", { key: "aaaa0001" }],
    ],
  );
});

test("a conversation that never answered reads the newest list from its own folder, else from any", async () => {
  run("bbbb0001", "/work/a");
  run("bbbb0002", "/work/b");
  run("bbbb0003", "/work/a");
  SessionCommands.answer("bbbb0001", listOf("one"));
  await sleep(5);
  SessionCommands.answer("bbbb0002", listOf("two"));

  assert.deepEqual(namesOf("bbbb0003"), ["one"]);
  assert.deepEqual(namesOf("cccc0001"), ["two"]);
});
