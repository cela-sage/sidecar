import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Stamp } from "../../../lib/sidecar/stamp.ts";
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

test("waiting needs a reason, a task on no project cannot run, and only a Task Lead's turn joins its history", () => {
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
  assert.deepEqual(
    TaskHistory.read("fattura").map((entry) => entry.kind),
    ["state", "state", "turn"],
  );
});
