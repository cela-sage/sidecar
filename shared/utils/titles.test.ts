import assert from "node:assert/strict";
import { test } from "node:test";
import { Titles } from "./titles.ts";

test("a role title belongs to the task its slug or its ticket names, and an own title belongs to none", () => {
  const owns = (name: string, slug: string): boolean => {
    const title = Titles.parse(name);
    return !!title && Titles.belongsTo(title, slug);
  };
  assert.equal(owns("[Cela] TL sidecar-task-board follower", "sidecar-task-board"), true);
  assert.equal(owns("[Cela] PL sidecar-task-board plan", "sidecar-task-board"), true);
  assert.equal(owns("[MF] AI-222 TL rebase", "ai-222"), true);
  assert.equal(owns("[Cela] TL sidecar-task-board follower", "follower"), false);
  assert.equal(owns("[MF] AI-506 MongoDB migration", "ai-506"), false);
  assert.equal(Titles.parse("no brackets here"), undefined);
});
