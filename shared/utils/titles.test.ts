import assert from "node:assert/strict";
import { test } from "node:test";
import { Titles } from "./titles.ts";

test("a role title belongs to the task its slug or its ticket names, and an own title belongs to none", () => {
  const owns = (name: string, slug: string): boolean => {
    const title = Titles.parse(name);
    return !!title && Titles.belongsTo(title, slug);
  };
  assert.equal(owns("[Cela] IC sidecar-task-board follower", "sidecar-task-board"), true);
  assert.equal(owns("[Cela] SL sidecar-task-board design", "sidecar-task-board"), true);
  assert.equal(owns("[MF] AI-222 IC rebase", "ai-222"), true);
  assert.equal(owns("[Cela] IC sidecar-task-board follower", "follower"), false);
  assert.equal(owns("[MF] AI-506 MongoDB migration", "ai-506"), false);
  assert.equal(Titles.parse("no brackets here"), undefined);
  assert.equal(Titles.parse("[Cela] IC sidecar-task-board DL handoff")?.role, "IC");
});

test("a conversation dropped on a task becomes its Individual Contributor, keeping the deadline and, in the same project, the ticket", () => {
  const lead = (was: string, token = "Cela"): string => Titles.asLead({ was, token, slug: "sidecar-tasks-face" });
  assert.equal(lead("[Cela] sidecar macOS zoom"), "[Cela] IC sidecar-tasks-face sidecar macOS zoom");
  assert.equal(
    lead("[MF] Oct 5 AI-222 rebase and mf-ui bump", "MF"),
    "[MF] Oct 5 AI-222 IC sidecar-tasks-face rebase and mf-ui bump",
  );
  assert.equal(lead("[MF] AI-222 rebase and mf-ui bump"), "[Cela] IC sidecar-tasks-face rebase and mf-ui bump");
  assert.equal(
    lead("Sep 30 — Paris ITA Airways Art. 9", "madong"),
    "[madong] Sep 30 IC sidecar-tasks-face Paris ITA Airways Art. 9",
  );
  assert.equal(lead("[Ops] SL rollout-plan review"), "[Cela] IC sidecar-tasks-face review");
  assert.equal(lead("[Ops] DL rollout-plan review"), "[Cela] IC sidecar-tasks-face rollout-plan review");
  assert.equal(lead("Notes"), "[Cela] IC sidecar-tasks-face Notes");
  const title = Titles.parse(lead("[Cela] sidecar DL review"));
  assert.equal(title?.role, "IC");
  assert.equal(!!title && Titles.belongsTo(title, "sidecar-tasks-face"), true);
});

test("a conversation dropped on a project takes its token, losing a role it had and a ticket from elsewhere", () => {
  const into = (was: string, token = "MF"): string => Titles.inProject({ was, token });
  assert.equal(into("[Cela] dark mode island visibility"), "[MF] dark mode island visibility");
  assert.equal(into("[MF] Oct 5 AI-222 rebase and mf-ui bump"), "[MF] Oct 5 AI-222 rebase and mf-ui bump");
  assert.equal(into("Sep 30 — Paris ITA Airways Art. 9", "madong"), "[madong] Sep 30 Paris ITA Airways Art. 9");
  assert.equal(into("[Ops] IC rollout-plan review"), "[MF] review");
});
