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
  assert.equal(Titles.parse("[Cela] TL sidecar-task-board PL handoff")?.role, "TL");
});

test("a conversation dropped on a task becomes its Task Lead, keeping the deadline and, in the same project, the ticket", () => {
  const lead = (was: string, token = "Cela"): string => Titles.asLead({ was, token, slug: "sidecar-tasks-face" });
  assert.equal(lead("[Cela] sidecar macOS zoom"), "[Cela] TL sidecar-tasks-face sidecar macOS zoom");
  assert.equal(
    lead("[MF] Oct 5 AI-222 rebase and mf-ui bump", "MF"),
    "[MF] Oct 5 AI-222 TL sidecar-tasks-face rebase and mf-ui bump",
  );
  assert.equal(lead("[MF] AI-222 rebase and mf-ui bump"), "[Cela] TL sidecar-tasks-face rebase and mf-ui bump");
  assert.equal(
    lead("Sep 30 — Paris ITA Airways Art. 9", "madong"),
    "[madong] Sep 30 TL sidecar-tasks-face Paris ITA Airways Art. 9",
  );
  assert.equal(lead("[Ops] PL rollout-plan review"), "[Cela] TL sidecar-tasks-face review");
  assert.equal(lead("Notes"), "[Cela] TL sidecar-tasks-face Notes");
  const title = Titles.parse(lead("[Cela] sidecar PL review"));
  assert.equal(title?.role, "TL");
  assert.equal(!!title && Titles.belongsTo(title, "sidecar-tasks-face"), true);
});
