import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import * as Events from "../../../lib/sidecar/events.ts";
import { Faces } from "../sessions/faces.ts";
import { refreshJobs } from "../sessions/jobs.ts";
import { Spawns } from "../sessions/spawns.ts";
import { TaskLane } from "../tasks/lane.ts";
import { Channels } from "./index.ts";
import { ChannelStore } from "./store.ts";

const home = realpathSync(mkdtempSync(join(tmpdir(), "channel-")));
const was = { ...process.env };
const heard = new Map<string, string[]>();
const servers: Server[] = [];
const task = join(home, "sidecar", "artifacts", "board.md");

const ALIVE = {
  dd000001: "[Cela] DL plan",
  dd000002: "[Cela] SL board design",
  dd000003: "[Cela] IC board lane",
  dd000005: "[MF] IC rebase mf-ui",
  dd000006: "[meta] EA triage",
};
const [DL, SL, LANE, DESK, NELL, EA, REVIEW] = [
  "dd000001",
  "dd000002",
  "dd000003",
  "dd000004",
  "dd000005",
  "dd000006",
  "dd000007",
];
const FAKE = join(dirname(fileURLToPath(import.meta.url)), "..", "sessions", "__fixtures__", "resuming-claude.ts");

const stamp = (state: string): void =>
  writeFileSync(
    task,
    `<!-- artifact\nslug:    board\ntitle:   Board\nproject: cela\nstate:   ${state}\n-->\n# Board\n`,
  );

const asIc = { by: LANE, who: "IC" as const };
const nameOf = (key: string): string => Faces.all().get(key)?.name ?? "";
const asYou = { by: "YOU", who: "YOU" as const };

const got = async (key: string): Promise<string[]> => {
  await sleep(30);
  const said = heard.get(key) ?? [];
  heard.set(key, []);
  return said.map((raw) => JSON.parse(raw.split("\n")[1] ?? "{}").message?.content ?? "");
};

const listen = async (key: string): Promise<string> => {
  const socketPath = join(home, `${key}.sock`);
  const server = createServer((socket) => socket.on("data", (chunk) => heard.get(key)?.push(String(chunk))));
  await new Promise<void>((ready) => server.listen(socketPath, ready));
  servers.push(server);
  heard.set(key, []);
  return socketPath;
};

const idOf = (key: string): string => `${key}-1111-2222-3333-444444444444`;

before(async () => {
  const agents = [
    { sessionId: idOf(DESK), id: DESK, state: "done", name: "[Cela] IC board desk", cwd: home },
    {
      ...{ sessionId: idOf(REVIEW), id: REVIEW, pid: process.pid, kind: "background", state: "working" },
      ...{ name: "[Cela] IC board review", cwd: home, startedAt: Date.now() - 60_000 },
    },
  ];
  Object.assign(process.env, {
    CLAUDE_CONFIG_DIR: home,
    CLAUDE_BIN: FAKE,
    WAKE_HOME: home,
    WAKE_LOG: join(home, "resumes.log"),
    WAKE_PID: String(process.pid),
    WAKE_SOCKET: await listen(REVIEW),
    WAKE_AGENTS: JSON.stringify(agents),
  });
  mkdirSync(join(home, "sessions"), { recursive: true });
  mkdirSync(join(home, "sidecar", "artifacts"), { recursive: true });
  writeFileSync(join(home, "resumes.log"), "");
  stamp("running");
  writeFileSync(join(home, "sessions", `${process.pid}.token.key`), "t");
  for (const [n, [key, name]] of Object.entries(ALIVE).entries()) {
    const entry = { pid: process.pid, sessionId: idOf(key), name, cwd: home, messagingSocketPath: await listen(key) };
    writeFileSync(join(home, "sessions", `${n}.json`), JSON.stringify({ ...entry, updatedAt: n }));
  }
  await refreshJobs();
  Spawns.record({ key: SL, by: DL });
});

after(() => {
  for (const server of servers) server.close();
  process.env = was;
});

test("the crew joins on its own, the killed one last, and a post with no @ notifies no one", async () => {
  const channel = Channels.read("board");
  assert.deepEqual(
    channel.members.map(({ key, role, life }) => [key, role, life]),
    [
      [DL, "DL", "alive"],
      [SL, "SL", "alive"],
      [REVIEW, "IC", "alive"],
      [LANE, "IC", "alive"],
      [DESK, "IC", "killed"],
    ],
  );
  assert.deepEqual(
    Object.fromEntries(channel.lines.map((line) => (line.kind === "join" ? [line.key, line.by] : [line.kind]))),
    { [DL]: undefined, [SL]: DL, [REVIEW]: undefined, [LANE]: undefined, [DESK]: undefined },
  );
  const faces = Faces.all();
  assert.deepEqual(
    channel.members.map(({ agent }) => agent),
    channel.members.map(({ key }) => faces.get(key)),
  );
  assert.equal(new Set(channel.members.map(({ agent }) => agent?.name)).size, 5);
  assert.equal(faces.has(EA), false);
  ChannelStore.append("board", { kind: "join", key: DL, title: "[Cela] DL plan", role: "DL" });
  ChannelStore.append("board", { kind: "kill", keys: [DESK] });
  assert.equal(Channels.read("board").lines.length, channel.lines.length);

  const posted = await Channels.post({ given: "board", author: asIc, text: "Desk rows are done." });
  assert.deepEqual(posted.reach, { notified: [], missed: [], outside: [] });
  assert.deepEqual(await Promise.all([DL, SL, NELL].map(got)), [[], [], []]);
});

test("@name interrupts that member alone, @all wakes every member alive but the author, and only a killed one is missed", async () => {
  const [ivo, juno] = [nameOf(SL), nameOf(LANE)];
  const one = await Channels.post({ given: "board", author: asIc, text: `@${ivo.toLowerCase()} take the row menu` });
  const [note] = await got(SL);
  assert.match(
    note ?? "",
    new RegExp(`^\\[\\[sidecar slug=board from=${LANE}\\]\\]\\n${juno} \`${LANE}\` \\(IC\\) in #board: @${ivo}`, "i"),
  );
  assert.match(note ?? "", new RegExp(`task board post "<reply>" --thread ${one.id}`));
  assert.deepEqual(await got(DL), []);

  const all = await Channels.post({ given: "board", author: asIc, text: "@all scope freeze" });
  assert.deepEqual([all.reach.all, all.reach.notified.sort(), all.reach.missed], [true, [DL, SL, REVIEW], []]);
  assert.match((await got(REVIEW))[0] ?? "", /@all scope freeze/);
  const gone = await Channels.post({ given: "board", author: asIc, text: `@${DESK} are you there?` });
  assert.deepEqual([gone.reach.notified, gone.reach.missed], [[], [DESK]]);
  const resumed = readFileSync(join(home, "resumes.log"), "utf8").trim().split("\n");
  assert.deepEqual(
    resumed.map((line) => JSON.parse(line).args),
    [["--bg", "--resume", idOf(REVIEW)]],
  );
  assert.equal(
    Events.read(0).events.some((event) => event.topic === "relay.sent"),
    false,
  );
});

test("@boss raises it to Marco until he answers in its thread, and his answer reaches the author", async () => {
  const since = Events.end();
  const ask = await Channels.post({ given: "board", author: asIc, text: "@boss fold done tasks or show them?" });
  assert.deepEqual(Channels.read("board").raised, [ask.id]);
  assert.deepEqual(
    Events.read(since).events.flatMap((event) => (event.topic === "channel.raised" ? [event.data.post] : [])),
    [ask.id],
  );
  await Channels.post({ given: "board", author: { by: SL, who: "SL" }, text: "+1, either works", thread: ask.id });
  assert.deepEqual(Channels.read("board").raised, [ask.id]);

  const answer = await Channels.post({
    given: "board",
    author: asYou,
    text: "Fold them like the tree",
    thread: ask.id,
  });
  assert.deepEqual(answer.reach.notified, [LANE]);
  assert.match((await got(LANE))[0] ?? "", /Marco answered your @boss in #board: Fold them like the tree/);
  const channel = Channels.read("board");
  assert.deepEqual([channel.raised, channel.threads[ask.id]?.length], [[], 2]);
});

test("an agent can @ only members, and Marco's @ of an outsider gives it one read and its thread alone", async () => {
  await assert.rejects(
    Channels.post({ given: "board", author: asIc, text: `@${NELL} same menu order?` }),
    /not in #board, and an agent can @ only the channel's members/,
  );
  await assert.rejects(Channels.post({ given: "board", author: asYou, text: "@ffff0000 hello" }), /no conversation/);
  const asked = await Channels.post({ given: "board", author: asYou, text: `@${NELL} does mf-ui take this order?` });
  assert.match(
    (await got(NELL))[0] ?? "",
    new RegExp(`one read of the channel up to this message: .*--upto ${asked.id}`),
  );

  const nell = { by: NELL, who: "IC" as const };
  assert.throws(() => Channels.take({ given: "board", reader: nell }), /not in #board/);
  const read = Channels.take({ given: "board", reader: nell, upto: asked.id });
  assert.equal(read.lines.at(-1)?.id, asked.id);
  assert.throws(() => Channels.take({ given: "board", reader: nell, upto: asked.id }), /spent your one read/);
  await assert.rejects(Channels.post({ given: "board", author: nell, text: "yes" }), /not in #board/);
  const reply = await Channels.post({ given: "board", author: nell, text: "yes, the same", thread: asked.id });
  assert.equal(reply.thread, asked.id);

  const assistant = await Channels.post({ given: "board", author: { by: EA, who: "EA" }, text: `@${NELL} thanks` });
  assert.deepEqual(assistant.reach.outside, [{ key: NELL }]);
});

test("two agents in one project never share a name, and a drawn pair reads back the same after a reload", () => {
  const keys = Array.from({ length: 220 }, (_, i) => `ee${String(i).padStart(6, "0")}`);
  const drawn = keys.map((key) => Faces.draw({ key, project: "Cela" }));
  const cela = [...Faces.all()].filter(([key]) => key.startsWith("ee") || [DL, SL, LANE, DESK].includes(key));
  assert.equal(new Set(cela.map(([, face]) => face.name.toLowerCase())).size, cela.length);
  assert.ok(drawn.every(({ icon }) => Number.isInteger(icon) && icon >= 0 && icon < 64));
  assert.deepEqual(
    keys.map((key) => Faces.all().get(key)),
    drawn,
  );
  assert.deepEqual(Faces.draw({ key: keys[0] ?? "", project: "MF" }), drawn[0]);
});

test("an archived channel is read only, and it says who archived it", async () => {
  TaskLane.state({ given: "board", caller: { who: "YOU" }, state: "done" });
  await assert.rejects(Channels.post({ given: "board", author: asYou, text: "one more thing" }), /archived/);
  const channel = Channels.read("board");
  assert.deepEqual(
    [channel.archived, channel.lines.at(-1)],
    [true, { kind: "archive", id: channel.lines.at(-1)?.id, at: channel.lines.at(-1)?.at, by: "YOU" }],
  );
});
