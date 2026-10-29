import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { isAlive } from "./registry.ts";
import { removeSession } from "./removal.ts";

const KEY = "ffff0001";
const ID = "ffff0001-1111-2222-3333-444444444444";

const FAKE_DAEMON = `#!/bin/sh
case "$1" in
  agents) if [ -f "$CLAUDE_CONFIG_DIR/daemon.json" ]; then cat "$CLAUDE_CONFIG_DIR/daemon.json"; else echo "[]"; fi ;;
  stop) echo "stop $2" >> "$CLAUDE_CONFIG_DIR/calls" ;;
  rm)
    echo "rm $2" >> "$CLAUDE_CONFIG_DIR/calls"
    if [ -f "$CLAUDE_CONFIG_DIR/rm-fails" ]; then echo "Session $2 is still running" >&2; exit 1; fi
    echo "[]" > "$CLAUDE_CONFIG_DIR/daemon.json"
    rm -rf "$CLAUDE_CONFIG_DIR/jobs/$2" ;;
esac
`;

let root: string;
let had: boolean;
let was: string | undefined;
let hadBin: boolean;
let wasBin: string | undefined;

function put(path: string, body: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
}

function survivors(): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

function seed(key: string, id: string): void {
  put(join(root, "jobs", key, "state.json"), JSON.stringify({ sessionId: id, name: "throwaway", state: "done" }));
  put(join(root, "jobs", key, "timeline.jsonl"), "{}\n");
  put(join(root, "artifacts", `session-${key}`), "/tmp/a-document-other-sessions-share.md\n");
  put(join(root, "canvas", `session-${key}`), "{}");
  put(join(root, "tasks", `session-${key}`, "1.json"), "{}");
  put(join(root, "teams", `session-${key}`, "config.json"), "{}");
  put(join(root, "mode", "state", `session-${key}.mode`), "swarm\n");
  put(join(root, "mode", "state", `session-${key}.style`), "edu\n");
  put(join(root, "sidecar", "versions", key, "HEAD"), "ref\n");
  put(join(root, "sidecar", "links", `${key}.json`), "{}\n");
  put(join(root, "sidecar", "conversations", key), "");
  put(join(root, "projects", "-tmp", `${id}.jsonl`), '{"transcript":"stays"}\n');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "removal-"));
  had = "CLAUDE_CONFIG_DIR" in process.env;
  was = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = root;
  hadBin = "CLAUDE_BIN" in process.env;
  wasBin = process.env.CLAUDE_BIN;
  process.env.CLAUDE_BIN = join(root, "bin", "claude");
  put(process.env.CLAUDE_BIN, FAKE_DAEMON);
  chmodSync(process.env.CLAUDE_BIN, 0o755);
  seed(KEY, ID);
  seed("ffff0002", "ffff0002-1111-2222-3333-444444444444");
  const mode = join(root, "mode-plugin", "bin", "mode");
  put(mode, '#!/bin/sh\nprintf "%s " "$@" >> "$CLAUDE_CONFIG_DIR/forgot"\n');
  chmodSync(mode, 0o755);
  put(join(root, "mode", "plugin-root"), `${join(root, "mode-plugin")}\n`);
});

afterEach(() => {
  if (had) process.env.CLAUDE_CONFIG_DIR = was ?? "";
  else delete process.env.CLAUDE_CONFIG_DIR;
  if (hadBin) process.env.CLAUDE_BIN = wasBin ?? "";
  else delete process.env.CLAUDE_BIN;
  rmSync(root, { recursive: true, force: true });
});

const listed = (extra: Record<string, unknown> = {}): void =>
  put(join(root, "daemon.json"), JSON.stringify([{ id: KEY, sessionId: ID, kind: "background", state: "done", ...extra }]));

const calls = (): string => (existsSync(join(root, "calls")) ? readFileSync(join(root, "calls"), "utf8") : "");

test("every place the session kept state goes, and the transcript and the neighbour stay", async () => {
  const outcome = await removeSession(KEY);
  assert.equal(outcome.refused, undefined);
  assert.equal(outcome.removed.length, 8);
  assert.deepEqual(
    survivors()
      .filter((path) => path.includes(KEY))
      .sort(),
    [`mode/state/session-${KEY}.mode`, `mode/state/session-${KEY}.style`, `projects/-tmp/${ID}.jsonl`],
  );
  assert.equal(existsSync(join(root, "artifacts", "session-ffff0002")), true);
  assert.equal(existsSync(join(root, "jobs", "ffff0002", "state.json")), true);
});

test("mode's own state is left to mode, through the CLI its plugin-root names", async () => {
  await removeSession(KEY);
  assert.equal(readFileSync(join(root, "forgot"), "utf8"), `--session ${KEY} forget `);
});

test("a second delete removes nothing and does not fail", async () => {
  await removeSession(KEY);
  assert.deepEqual(await removeSession(KEY), { key: KEY, removed: [], killed: undefined });
});

test("a key that is not eight hex is refused before anything is touched", async () => {
  const outcome = await removeSession("../../etc");
  assert.equal(outcome.refused, "not a session key");
  assert.equal(existsSync(join(root, "jobs", KEY)), true);
});

// The key is a truncation of the uuid, so this is the collision that would delete a stranger.
test("a state file that does not key to its own directory is refused", async () => {
  put(join(root, "jobs", KEY, "state.json"), JSON.stringify({ sessionId: "99999999-1111-2222-3333-444444444444" }));
  const outcome = await removeSession(KEY);
  assert.match(outcome.refused ?? "", /does not key to this session/);
  assert.equal(existsSync(join(root, "artifacts", `session-${KEY}`)), true);
});

test("a background job the daemon owns ends through claude stop then rm, never a signal, and goes once unlisted", async () => {
  const sleeper = spawn("sleep", ["30"]);
  listed({ pid: sleeper.pid });
  try {
    const outcome = await removeSession(KEY);
    assert.equal(outcome.refused, undefined);
    assert.equal(outcome.killed, true);
    assert.equal(calls(), `stop ${KEY}\nrm ${KEY}\n`);
    assert.equal(isAlive(sleeper.pid ?? 0), true);
    assert.equal(existsSync(join(root, "artifacts", `session-${KEY}`)), false);
    assert.equal(existsSync(join(root, "projects", "-tmp", `${ID}.jsonl`)), true);
  } finally {
    sleeper.kill();
  }
});

test("a background job claude rm refuses keeps everything the sidecar holds for it", async () => {
  listed();
  put(join(root, "rm-fails"), "");
  const outcome = await removeSession(KEY);
  assert.match(outcome.refused ?? "", /claude rm ffff0001 failed: Session ffff0001 is still running/);
  assert.equal(existsSync(join(root, "artifacts", `session-${KEY}`)), true);
});

test("a job in worktree isolation the daemon lists is removed through it too", async () => {
  put(join(root, "jobs", KEY, "state.json"), JSON.stringify({ sessionId: ID, bgIsolation: "worktree" }));
  listed();
  const outcome = await removeSession(KEY);
  assert.equal(outcome.refused, undefined);
  assert.equal(calls(), `stop ${KEY}\nrm ${KEY}\n`);
});

test("a job in worktree isolation is left to the CLI", async () => {
  put(join(root, "jobs", KEY, "state.json"), JSON.stringify({ sessionId: ID, bgIsolation: "worktree" }));
  const outcome = await removeSession(KEY);
  assert.match(outcome.refused ?? "", /isolation/);
  assert.equal(existsSync(join(root, "jobs", KEY)), true);
});
