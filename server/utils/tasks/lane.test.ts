import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Stamp } from "../../../lib/sidecar/stamp.ts";
import { HistoryLines } from "../../../shared/utils/history.ts";
import { TaskCommand } from "../../../bin/task.ts";
import { TaskHistory } from "./history.ts";
import { TaskLane } from "./lane.ts";
import { TaskNotice } from "./notice.ts";
import { TaskTrash } from "./trash.ts";

const home = mkdtempSync(join(tmpdir(), "lane-"));
process.env.CLAUDE_CONFIG_DIR = home;
process.env.CLAUDE_BIN = join(home, "no-such-claude");
const artifacts = join(home, "sidecar", "artifacts");
mkdirSync(artifacts, { recursive: true });

const task = (slug: string, state: string): string => {
  const path = join(artifacts, `${slug}.md`);
  writeFileSync(
    path,
    `<!-- artifact\nslug:    ${slug}\ntitle:   Board\nproject: cela\nstate:   ${state}\n-->\n# Board\n\n## Solution\n\nThe Project Lead spawns a Task Lead.\n`,
  );
  return path;
};

const stateOf = (path: string): string | undefined => Stamp.fields(readFileSync(path, "utf8")).state;
const lead = { who: "TL" as const, from: "[Cela] TL board lane" };

test("an escalation blocks the task, Marco's pick settles it back to running, and a hire never blocks", () => {
  const path = task("board", "running");
  const { thread } = TaskLane.escalate({
    given: "board",
    caller: lead,
    kind: "escalation",
    text: "Which model runs a Task Lead?",
    options: ["Sonnet", "Opus"],
    quote: "The Project Lead spawns a Task Lead.",
  });
  assert.equal(stateOf(path), "blocked");
  assert.deepEqual(thread.anchor, { quote: "The Project Lead spawns a Task Lead.", label: "Solution" });

  TaskLane.escalate({ given: "board", caller: { who: "PL" }, kind: "hire", text: "a tester, Sonnet xhigh" });
  assert.equal(stateOf(path), "blocked");

  const decided = TaskLane.decide({ given: "board", caller: { who: "YOU" }, answer: "1", thread: "1" });
  assert.equal(decided.text, "Sonnet");
  assert.equal(stateOf(path), "running");
  assert.throws(() => TaskLane.decide({ given: "board", caller: { who: "YOU" }, answer: "1", thread: "1" }), /settled/);

  const hire = TaskLane.decide({ given: "board", caller: { who: "YOU" }, answer: "2" });
  assert.equal(hire.text, "Refused: a tester, Sonnet xhigh");
  assert.deepEqual(
    TaskHistory.read("board").map((entry) => [entry.kind, "move" in entry ? entry.move?.now : undefined]),
    [
      ["ask", "blocked"],
      ["ask", undefined],
      ["decide", "running"],
      ["decide", undefined],
    ],
  );
});

test("a judge with --settle unblocks the task as the Project Lead's decision, and a decide on it is refused", () => {
  const path = task("verdict", "running");
  const pl = { who: "PL" as const, from: "[Cela] PL board plan" };
  const asked = { given: "verdict", caller: lead, kind: "escalation" as const, options: ["No line", "Queued"] };
  TaskLane.escalate({ ...asked, text: "How does the earlier exchange draw?" });
  assert.throws(() => TaskLane.judge({ given: "verdict", caller: pl, verdict: " " }), /verdict in quotes/);
  assert.equal(
    TaskLane.judge({ given: "verdict", caller: pl, verdict: "Transcripts settle it", pick: 1 }).decided,
    undefined,
  );
  assert.equal(stateOf(path), "blocked");

  const standing = TaskLane.judge({ given: "verdict", caller: lead, verdict: "", settle: true }).decided;
  assert.deepEqual(
    [standing?.text, standing?.ask.decision?.who, standing?.ask.decision?.from],
    ["No line", "PL", pl.from],
  );
  assert.equal(stateOf(path), "running");
  assert.throws(
    () => TaskLane.decide({ given: "verdict", caller: { who: "YOU" }, answer: "2", thread: "1" }),
    /#1 is settled already by the Project Lead/,
  );

  TaskLane.escalate({ ...asked, text: "And the answer?" });
  const once = TaskLane.judge({ given: "verdict", caller: pl, verdict: "Once, on the last", settle: true }).decided;
  assert.deepEqual([once?.text, once?.ask.verdict?.from], ["Once, on the last", pl.from]);
  assert.equal(stateOf(path), "running");

  const lines = TaskHistory.read("verdict").map((entry) => HistoryLines.of(entry));
  assert.deepEqual(
    lines.map(({ lead: said, chips }) => [said, chips]),
    [
      ["Escalated: ", ["running to blocked", "notified you"]],
      ["Judged it: ", ["picked option 1"]],
      ["Settled it: ", ["picked option 1", "settled", "blocked to running"]],
      ["Escalated: ", ["running to blocked", "notified you"]],
      ["Settled it: ", ["settled", "blocked to running"]],
    ],
  );
  assert.equal(
    lines.some((one) => one.isDecision),
    false,
  );
});

test("a decide typed at a Task Lead's prompt is Marco's, in the history and on the thread", () => {
  task("desk", "running");
  TaskLane.escalate({
    given: "desk",
    caller: lead,
    kind: "escalation",
    text: "Where does the icon go?",
    options: ["In"],
  });
  const decided = TaskLane.decide({ given: "desk", caller: lead, answer: "1" });
  assert.equal(decided.ask.decision?.who, "YOU");
  const [entry] = TaskHistory.read("desk").filter((one) => one.kind === "decide");
  assert.ok(entry && HistoryLines.of(entry).isDecision);
  assert.equal(entry.from, lead.from);
});

test("a new task is an unassigned .md with the four parts, and Undo after a drop puts it back in the inbox", () => {
  const made = TaskLane.create("Hook that blocks committing settings.local.json");
  assert.equal(made.slug, "hook-that-blocks-committing-settings");
  assert.equal(TaskLane.create("Hook that blocks committing settings.local.json").slug, `${made.slug}-2`);
  const text = readFileSync(made.path, "utf8");
  assert.deepEqual(Stamp.task(Stamp.fields(text)), { state: "unassigned" });
  assert.match(text, /^## Problem\n\n## Pain point\n\n## Solution\n\n## Impact\n$/m);

  assert.equal(TaskLane.assign({ given: made.slug, caller: { who: "YOU" }, project: "Cela" }).task.state, "assigned");
  TaskLane.state({ given: made.slug, caller: { who: "YOU" }, state: "unassigned" });
  assert.equal(Stamp.fields(readFileSync(made.path, "utf8")).project, undefined);
});

test("sidecar task new writes an unassigned task through the lane and prints only its slug", async (context) => {
  const said = context.mock.method(console, "log", () => undefined);
  assert.equal(await TaskCommand.run(["new", "Route the Desk inbox"], "http://localhost:0"), 0);
  assert.deepEqual(
    said.mock.calls.map((call) => call.arguments),
    [["route-the-desk-inbox"]],
  );
  assert.equal(stateOf(join(artifacts, "route-the-desk-inbox.md")), "unassigned");
  context.mock.method(console, "error", () => undefined);
  assert.equal(await TaskCommand.run(["new"], "http://localhost:0"), 2);
});

test("waiting needs a reason, a task on no project cannot run, and a Task Lead's turn or a message sent from the task joins its history", () => {
  task("fattura", "running");
  assert.throws(() => TaskLane.state({ given: "fattura", caller: lead, state: "waiting" }), /--reason/);
  TaskLane.state({ given: "fattura", caller: lead, state: "waiting", reason: "they confirm receipt", on: "Cosmico" });
  TaskLane.state({ given: "fattura", caller: lead, state: "unassigned" });
  assert.throws(() => TaskLane.state({ given: "fattura", caller: lead, state: "running" }), /no project/);

  assert.deepEqual(
    TaskLane.heard({
      caller: { who: "TL", from: "[Madong] TL fattura follow-up" },
      kind: "turn",
      text: "Sent it.",
    }).map((one) => one.slug),
    ["fattura"],
  );
  assert.deepEqual(TaskLane.heard({ caller: { who: "YOU", from: "[madong] fattura" }, kind: "turn", text: "x" }), []);
  const toAssistant = { caller: { who: "YOU" as const, from: "[meta] EA daily triage" }, kind: "message" as const };
  assert.deepEqual(TaskLane.heard({ ...toAssistant, text: "Where does it stand?" }), []);
  assert.deepEqual(
    TaskLane.heard({ ...toAssistant, text: "Where does it stand?", slug: "fattura" }).map((one) => one.slug),
    ["fattura"],
  );
  assert.deepEqual(
    TaskHistory.read("fattura").map((entry) => (entry.kind === "message" ? `message to ${entry.to}` : entry.kind)),
    ["state", "state", "turn", "message to [meta] EA daily triage"],
  );
});

test("a rename rewrites the stamp title and the heading, keeps the slug, and lands in the history", async (context) => {
  const path = task("menu", "running");
  context.mock.method(console, "log", () => undefined);
  assert.equal(await TaskCommand.run(["menu", "rename", "Right-click", "menu"], "http://localhost:0"), 0);
  const text = readFileSync(path, "utf8");
  assert.equal(Stamp.fields(text).title, "Right-click menu");
  assert.match(text, /\n# Right-click menu\n/);
  assert.equal(TaskLane.read({ given: "menu", caller: lead }).file.slug, "menu");
  const [renamed] = TaskHistory.read("menu");
  assert.equal(renamed && HistoryLines.of(renamed).text, "Renamed it Right-click menu, from Board.");
  assert.throws(() => TaskLane.rename({ given: "menu", caller: lead, title: "  " }), /new title/);
});

test("a remove in any state trashes the task with one history entry, and only its live Task Leads are stopped", async () => {
  task("loop", "running");
  assert.deepEqual(await TaskLane.remove({ given: "loop", caller: { who: "YOU" } }), { stopped: [] });
  assert.equal(existsSync(join(artifacts, "loop.md")), false);
  assert.equal(existsSync(join(home, "sidecar", "trash", "loop.md")), true);
  assert.equal(TaskTrash.restore("loop"), true);
  assert.deepEqual(
    TaskHistory.read("loop").map((entry) => HistoryLines.of(entry).text),
    ["Removed it."],
  );
  const session = (key: string, name: string, live = true) => ({
    key,
    id: key,
    name,
    cwd: "/tmp",
    live,
    artifacts: [],
  });
  assert.deepEqual(
    TaskLane.leadsOf(
      [
        session("aaaa0001", "[Cela] TL loop build"),
        session("aaaa0002", "[Cela] PL loop plan"),
        session("aaaa0003", "[Cela] TL loop-two build"),
        { ...session("aaaa0004", "[Cela] TL loop old", false), archived: true },
      ],
      "loop",
    ).map((one) => one.key),
    ["aaaa0001"],
  );
});

test("an option keeps the commas inside it, and only one-word options split on the comma shorthand", async (context) => {
  context.mock.method(TaskNotice, "raise", async () => "page");
  context.mock.method(console, "log", () => undefined);
  task("spike", "running");
  const optionsOf = async (...given: string[]): Promise<string[] | undefined> => {
    const args = given.flatMap((one) => ["--options", one]);
    await TaskCommand.run(["spike", "escalate", "Which theme?", ...args], "http://localhost:0");
    return TaskLane.read({ given: "spike", caller: lead }).asks.at(-1)?.ask.options;
  };
  assert.deepEqual(await optionsOf("Keep the light theme, unreadable in light", "Drop it"), [
    "Keep the light theme, unreadable in light",
    "Drop it",
  ]);
  assert.deepEqual(await optionsOf("Keep it, unreadable in light"), ["Keep it, unreadable in light"]);
  assert.deepEqual(await optionsOf("Sonnet, Opus,Haiku"), ["Sonnet", "Opus", "Haiku"]);
});
