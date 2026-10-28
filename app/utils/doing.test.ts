import assert from "node:assert/strict";
import { test } from "node:test";
import { doingOf, stepOf, wroteIn } from "./doing.ts";

const acting = (tool: string, arg?: string) => ({
  at: 1,
  role: "assistant" as const,
  text: tool,
  kind: "acting" as const,
  tool,
  ...(arg ? { arg } : {}),
});
const said = { at: 1, role: "assistant" as const, text: "Reading the parser first.", kind: "narration" as const };

test("asked but nothing back yet is thinking", () => {
  assert.equal(doingOf({ awaiting: true }), "thinking");
  assert.equal(doingOf({ awaiting: true, turn: acting("Bash") }), "thinking");
});

test("no tool is thinking; an unlisted tool is not", () => {
  assert.equal(doingOf({ turn: said }), "thinking");
  assert.equal(doingOf({ turn: { ...said, kind: "thinking" } }), "thinking");
  assert.notEqual(doingOf({ turn: acting("TaskUpdate") }), "thinking");
});

test("looking around is investigating, short shell included", () => {
  for (const tool of ["Read", "Grep", "Glob", "Bash", "WebSearch", "Skill"]) {
    assert.equal(doingOf({ turn: acting(tool) }), "investigating", tool);
  }
});

test("a write switches to coding", () => {
  for (const tool of ["Write", "Edit", "NotebookEdit"]) {
    assert.equal(doingOf({ turn: acting(tool) }), "coding", tool);
  }
});

// The latch is the whole point: after a write, reading is part of the same job.
test("once it has written, reading stays coding", () => {
  assert.equal(doingOf({ turn: acting("Read") }), "investigating");
  assert.equal(doingOf({ turn: acting("Read"), wrote: true }), "coding");
  assert.equal(doingOf({ turn: acting("Grep"), wrote: true }), "coding");
});

test("shell only becomes running once it has actually run long", () => {
  assert.equal(doingOf({ turn: acting("Bash") }), "investigating");
  assert.equal(doingOf({ turn: acting("Bash"), long: true }), "running");
  assert.equal(doingOf({ turn: acting("Bash"), long: true, wrote: true }), "running");
});

test("offloading to another party is running at once, MCP by prefix", () => {
  for (const tool of ["Agent", "Task", "Workflow", "mcp__langfuse__getPrompt"]) {
    assert.equal(doingOf({ turn: acting(tool) }), "running", tool);
  }
});

test("nothing at all is idle", () => {
  assert.equal(doingOf({}), "idle");
});

test("the step line says what the newest block does, in words", () => {
  assert.equal(stepOf({ awaiting: true }), "Reading your message");
  assert.equal(stepOf({ turn: acting("Read", "Cela/sidecar-tasks-face.md") }), "Reading Cela/sidecar-tasks-face.md");
  assert.equal(stepOf({ turn: acting("Bash", "Mark the task done") }), "Mark the task done");
  assert.equal(stepOf({ turn: acting("Bash") }), "Bash");
  assert.equal(stepOf({ turn: acting("mcp__claude_ai_Gmail__search_threads") }), "Using search_threads");
  assert.equal(stepOf({ turn: { ...said, kind: "thinking" } }), "Thinking");
  assert.equal(stepOf({ turn: { ...said, text: "Routing the inbox.\nThen the board." } }), "Routing the inbox.");
  assert.equal(stepOf({}), undefined);
});

test("wroteIn spots the calls that set the latch", () => {
  assert.equal(wroteIn(acting("Edit")), true);
  assert.equal(wroteIn(acting("Read")), false);
  assert.equal(wroteIn(said), false);
  assert.equal(wroteIn(undefined), false);
});
