import assert from "node:assert/strict";
import { test } from "node:test";
import type { LiveSession } from "../../shared/types/session.ts";
import { Tasks } from "./tasks.ts";

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

test("a conversation reads the claude agents state off its lane, and off its status without one", () => {
  assert.equal(Tasks.agentStateOf(session({ lane: { name: "blocked" } })), "needs input");
  assert.equal(Tasks.agentStateOf(session({ lane: { name: "working" } })), "working");
  assert.equal(Tasks.agentStateOf(session({ lane: { name: "done" }, status: "busy" })), "completed");
  assert.equal(Tasks.agentStateOf(session({ status: "busy" })), "working");
  assert.equal(Tasks.agentStateOf(session({ status: "idle" })), "completed");
});
