import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { liveSessions } from "./index.ts";
import { retitle } from "./title.ts";

const JOB = { key: "eeee0001", id: "eeee0001-1111-2222-3333-444444444444" };
const LOOSE = { key: "eeee0002", id: "eeee0002-1111-2222-3333-444444444444" };

let root: string;
let env: { name: string; had: boolean; was?: string }[] = [];

const transcriptOf = (id: string): string => join(root, "projects", "-tmp-work", `${id}.jsonl`);

function put(path: string, body: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "title-"));
  env = ["CLAUDE_CONFIG_DIR", "CLAUDE_BIN"].map((name) => ({ name, had: name in process.env, was: process.env[name] }));
  process.env.CLAUDE_CONFIG_DIR = root;
  process.env.CLAUDE_BIN = join(root, "no-such-claude");
  for (const { id } of [JOB, LOOSE]) put(transcriptOf(id), `${JSON.stringify({ cwd: "/tmp/work", sessionId: id })}\n`);
  put(join(root, "jobs", JOB.key, "state.json"), JSON.stringify({ sessionId: JOB.id, name: "[Cela] macOS zoom" }));
});

afterEach(() => {
  for (const { name, had, was } of env) {
    if (had) process.env[name] = was ?? "";
    else delete process.env[name];
  }
  rmSync(root, { recursive: true, force: true });
});

const nameOf = (key: string): string | undefined => liveSessions({ key }).find((one) => one.key === key)?.name;

test("a rename lands in the job list and the transcript, marked as yours", async () => {
  const title = "[Cela] TL sidecar-tasks-face macOS zoom";
  assert.equal(await retitle({ key: JOB.key, title }), true);
  assert.equal(nameOf(JOB.key), title);
  const { name, nameSource, sessionId } = JSON.parse(readFileSync(join(root, "jobs", JOB.key, "state.json"), "utf8"));
  assert.deepEqual({ name, nameSource, sessionId }, { name: title, nameSource: "user", sessionId: JOB.id });
  const last = readFileSync(transcriptOf(JOB.id), "utf8").trim().split("\n").at(-1) ?? "";
  assert.deepEqual(JSON.parse(last), { type: "custom-title", customTitle: title, sessionId: JOB.id });
});

test("a conversation with no job takes the name from its transcript, and an unknown one is refused", async () => {
  assert.equal(await retitle({ key: LOOSE.key, title: "[Cela] TL sidecar-tasks-face notes" }), true);
  assert.equal(nameOf(LOOSE.key), "[Cela] TL sidecar-tasks-face notes");
  assert.equal(await retitle({ key: "eeee0003", title: "[Cela] nothing" }), false);
});
