import assert from "node:assert/strict";
import { test } from "node:test";
import type { TaskMeta } from "./tasks.ts";
import { Receipts } from "./receipt.ts";

const PROJECTS = [
  { key: "cela", name: "Cela", token: "Cela", folder: "/tmp/cela" },
  { key: "meta", name: "meta", token: "meta", folder: "/tmp" },
];

const meta = (title: string, project?: string): TaskMeta => ({
  slug: "structured-conversation-rename",
  title,
  kind: "page",
  format: "md",
  path: "/tmp/structured-conversation-rename.md",
  task: { state: "running", ...(project ? { project } : {}) },
});

const pushed = { slug: "structured-conversation-rename", title: "Structured conversation rename" };

test("a receipt pushed before the task moved on reads its project and title from the catalogue now", () => {
  const line = Receipts.lineOf(pushed, {
    tasks: [meta("Rename conversations by structure", "meta")],
    projects: PROJECTS,
  });
  assert.equal(line.title, "Rename conversations by structure");
  assert.equal(line.where?.project.name, "meta");
  assert.equal(line.where?.tint, "violet");
});

test("a task still in the backlog has no project, and one that left the catalogue keeps its last title", () => {
  assert.deepEqual(Receipts.lineOf(pushed, { tasks: [meta("Structured conversation rename")], projects: PROJECTS }), {
    title: "Structured conversation rename",
  });
  assert.deepEqual(Receipts.lineOf(pushed, { tasks: [], projects: PROJECTS }), {
    title: "Structured conversation rename",
  });
});

test("a project the sidecar does not know still shows under its key", () => {
  const line = Receipts.lineOf(pushed, { tasks: [meta("Structured conversation rename", "ops")], projects: PROJECTS });
  assert.deepEqual([line.where?.project.name, line.where?.tint], ["ops", "slate"]);
});
