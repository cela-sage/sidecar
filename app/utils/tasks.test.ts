import assert from "node:assert/strict";
import { test } from "node:test";
import type { HistoryEntry } from "../../shared/types/history.ts";
import type { LiveSession } from "../../shared/types/session.ts";
import { Tasks } from "./tasks.ts";
import { Timeline } from "./timeline.ts";

const session = (patch: Partial<LiveSession>): LiveSession => ({
  artifacts: [],
  cwd: "/tmp",
  id: "id",
  key: "aaaaaaaa",
  live: true,
  ...patch,
});

test("the strip passes what is behind, marks where it is, and dashes what is ahead", () => {
  const strip = (state: Parameters<typeof Tasks.stepsOf>[0]): string =>
    Tasks.stepsOf(state)
      .map((step) => `${step.label}:${step.kind}`)
      .join(" ");
  assert.equal(strip("running"), "Unassigned:past Assigned:past Assessed:past Running:running Done:future");
  assert.equal(
    strip("blocked"),
    "Unassigned:past Assigned:past Assessed:past Running:past Needs you:needs Done:future",
  );
  assert.equal(strip("unassigned"), "Unassigned:waiting Assigned:future Assessed:future Running:future Done:future");
  assert.equal(strip("done"), "Unassigned:past Assigned:past Assessed:past Running:past Done:done");
  assert.deepEqual(
    Tasks.stepsOf("running").map((step) => step.joint),
    ["none", "solid", "solid", "primary", "dashed"],
  );
});

test("the history folds runs, puts the divider under what the Project Lead read, and tells the strip how it got here", () => {
  const lead = "[Cela] TL board lane";
  const entries: HistoryEntry[] = [
    { at: "2026-10-27T09:00:00Z", who: "TL", from: lead, kind: "turn", text: "Started." },
    { at: "2026-10-27T09:10:00Z", who: "PL", kind: "read" },
    { at: "2026-10-27T10:00:00Z", who: "TL", from: lead, kind: "ask", thread: "t1", ask: "escalation", text: "Which model?", options: ["Sonnet"], move: { was: "running", now: "blocked" } },
    { at: "2026-10-27T10:02:00Z", who: "YOU", kind: "decide", thread: "t1", ask: "escalation", text: "Sonnet", option: 1, move: { was: "blocked", now: "running" } },
    { at: "2026-10-27T10:30:00Z", who: "YOU", kind: "content", parts: ["Problem"] },
    { at: "2026-10-27T10:40:00Z", who: "YOU", kind: "content", parts: ["Pain point"] },
    { at: "2026-10-27T11:00:00Z", who: "TL", from: lead, kind: "turn", text: "Laid out the comment." },
    { at: "2026-10-27T12:05:00Z", who: "TL", from: lead, kind: "turn", text: "It works end to end." },
  ];
  const rows = Timeline.rows(entries);
  assert.deepEqual(
    rows.map((row) => `${row.who} ${row.lead}${row.text} [${row.chips.join(", ")}]`),
    [
      "TL It works end to end. [2 turns]",
      "YOU Edited Pain point and Problem. [content change]",
      "YOU You decided: Sonnet [decision, blocked to running]",
      "TL Escalated: Which model? [running to blocked, notified you]",
      "TL Started. [turn]",
    ],
  );
  assert.equal(Timeline.dividerAt(rows, Timeline.readAt(entries)), 0);
  assert.deepEqual(
    Timeline.rows(entries, { decisionsOnly: true }).map((row) => row.text),
    ["Sonnet"],
  );

  const story = Timeline.story(entries, "running");
  assert.deepEqual(story, { settledBy: "YOU" });
  const steps = (state: Parameters<typeof Tasks.stepsOf>[0], told: ReturnType<typeof Timeline.story>): string =>
    Tasks.stepsOf(state, told)
      .slice(3)
      .map((step) => `${step.label}:${step.kind}`)
      .join(" ");
  assert.equal(steps("running", story), "Running:running Blocked, settled by you:decided Done:future");

  const waited: HistoryEntry[] = [
    { at: "2026-10-26T16:40:00Z", who: "TL", kind: "state", move: { was: "running", now: "waiting" }, on: "Cosmico", reason: "they confirm" },
    { at: "2026-10-27T16:40:00Z", who: "TL", kind: "state", move: { was: "waiting", now: "running" } },
  ];
  assert.equal(steps("waiting", Timeline.story(waited.slice(0, 1), "waiting")), "Running:past Waiting on Cosmico:waiting Done:future");
  assert.equal(steps("running", Timeline.story(waited, "running")), "Waited 1 day:past Running:running Done:future");
});

test("a conversation reads the claude agents state off its lane, and off its status without one", () => {
  assert.equal(Tasks.agentStateOf(session({ lane: { name: "blocked" } })), "needs input");
  assert.equal(Tasks.agentStateOf(session({ lane: { name: "working" } })), "working");
  assert.equal(Tasks.agentStateOf(session({ lane: { name: "done" }, status: "busy" })), "completed");
  assert.equal(Tasks.agentStateOf(session({ status: "busy" })), "working");
  assert.equal(Tasks.agentStateOf(session({ status: "idle" })), "completed");
});
