import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { read } from "../../../lib/sidecar/events.ts";
import { deliver } from "./inbox.ts";
import { Lifecycle } from "./lifecycle.ts";

const FAKE = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "resuming-claude.ts");
const ASLEEP = "cafe0000-1111-2222-3333-444444444444";
const OTHER = "cafe1111-1111-2222-3333-444444444444";
const NAMES = ["CLAUDE_CONFIG_DIR", "CLAUDE_BIN", "WAKE_HOME", "WAKE_LOG", "WAKE_PID", "WAKE_SOCKET"] as const;

let home = "";
let work = "";
let server: Server;
const heard: string[] = [];
const was = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));

const resumes = (): { args: string[]; cwd: string; claudeVars: string[] }[] =>
  readFileSync(join(home, "resumes.log"), "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

before(async () => {
  home = realpathSync(mkdtempSync(join(tmpdir(), "wake-")));
  work = join(home, "work");
  mkdirSync(join(home, "sessions"));
  mkdirSync(work);
  writeFileSync(join(home, "resumes.log"), "");
  for (const id of [ASLEEP, OTHER]) {
    mkdirSync(join(home, "projects", "-wake"), { recursive: true });
    writeFileSync(join(home, "projects", "-wake", `${id}.jsonl`), `${JSON.stringify({ type: "user", cwd: work })}\n`);
  }
  chmodSync(FAKE, 0o755);
  server = createServer((socket) => socket.on("data", (chunk) => heard.push(String(chunk))));
  await new Promise<void>((ready) => server.listen(join(home, "inbox.sock"), ready));
  Object.assign(process.env, {
    CLAUDE_CONFIG_DIR: home,
    CLAUDE_BIN: FAKE,
    WAKE_HOME: home,
    WAKE_LOG: join(home, "resumes.log"),
    WAKE_PID: String(process.pid),
    WAKE_SOCKET: join(home, "inbox.sock"),
  });
});

after(() => {
  server.close();
  rmSync(home, { recursive: true, force: true });
  for (const name of NAMES) {
    const prior = was[name];
    if (prior) process.env[name] = prior;
    else delete process.env[name];
  }
});

test("two messages to a conversation no process runs wake it once, in its folder, and both land", async () => {
  const sent = await Promise.all([
    deliver({ key: "cafe0000", text: "first" }),
    deliver({ key: "cafe0000", text: "second" }),
  ]);
  assert.deepEqual(sent, [
    { delivered: true, session: "cafe0000" },
    { delivered: true, session: "cafe0000" },
  ]);
  assert.deepEqual(resumes(), [{ args: ["--bg", "--resume", ASLEEP], cwd: work, claudeVars: [] }]);
  await sleep(50);
  assert.match(heard.join(""), /first[\s\S]*second|second[\s\S]*first/);
});

test("a passive ask never starts a process, and neither does a key with no transcript", async () => {
  assert.deepEqual(await deliver({ key: "cafe1111", text: "stop", canWake: false }), {
    delivered: false,
    reason: "no-live-session",
  });
  assert.deepEqual(await deliver({ key: "feedbeef", text: "hello" }), { delivered: false, reason: "no-live-session" });
  assert.equal(resumes().length, 1);
});

test("a resume wakes a killed conversation without a message, announces alive, and refuses a running one", async () => {
  assert.deepEqual(await Lifecycle.resume("cafe1111"), { key: "cafe1111", life: "alive" });
  assert.deepEqual(resumes().at(-1)?.args, ["--bg", "--resume", OTHER]);
  assert.deepEqual(read().events.at(-1)?.data, { key: "cafe1111", doing: false, asking: false, life: "alive" });
  await assert.rejects(Lifecycle.resume("cafe1111"), /already running/);
});
