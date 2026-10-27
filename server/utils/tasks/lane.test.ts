import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Stamp } from "../../../lib/sidecar/stamp.ts";
import { HistoryLines } from "../../../shared/utils/history.ts";
import { TaskCommand } from "../../../bin/task.ts";
import { TaskHistory } from "./history.ts";
import { TaskLane } from "./lane.ts";

const home = mkdtempSync(join(tmpdir(), "lane-"));
process.env.CLAUDE_CONFIG_DIR = home;
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

test("a decide typed at a Task Lead's prompt is Marco's, in the history and on the thread", () => {
  task("desk", "running");
  TaskLane.escalate({ given: "desk", caller: lead, kind: "escalation", text: "Where does the icon go?", options: ["In"] });
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
    TaskLane.heard({ caller: { who: "TL", from: "[Madong] TL fattura follow-up" }, kind: "turn", text: "Sent it." }).map(
      (one) => one.slug,
    ),
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
