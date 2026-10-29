import assert from "node:assert/strict";
import { test } from "node:test";
import type { HistoryEntry } from "../../shared/types/history.ts";
import type { LiveSession } from "../../shared/types/session.ts";
import { Org, type OrgConversation } from "./org.ts";
import { Tasks, type TaskMeta } from "./tasks.ts";
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
  assert.equal(strip("running"), "Backlog:past Assigned:past Assessed:past In progress:running Done:future");
  assert.equal(strip("blocked"), "Backlog:past Assigned:past Assessed:past In progress:past Blocked:needs Done:future");
  assert.equal(strip("unassigned"), "Backlog:waiting Assigned:future Assessed:future In progress:future Done:future");
  assert.equal(strip("done"), "Backlog:past Assigned:past Assessed:past In progress:past Done:done");
  assert.deepEqual(
    Tasks.stepsOf("blocked").map((step) => step.state),
    ["unassigned", "assigned", "assessed", "running", undefined, "done"],
  );
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
  assert.equal(steps("running", story), "In progress:running Blocked, settled by you:decided Done:future");

  const waited: HistoryEntry[] = [
    { at: "2026-10-26T16:40:00Z", who: "TL", kind: "state", move: { was: "running", now: "waiting" }, on: "Cosmico", reason: "they confirm" },
    { at: "2026-10-27T16:40:00Z", who: "TL", kind: "state", move: { was: "waiting", now: "running" } },
  ];
  assert.equal(steps("waiting", Timeline.story(waited.slice(0, 1), "waiting")), "In progress:past Waiting on Cosmico:waiting Done:future");
  assert.equal(steps("running", Timeline.story(waited, "running")), "Waited 1 day:past In progress:running Done:future");
});

test("the tree drops a Done task you removed or that went Done a day ago, and lists only what agent view lists", () => {
  const done = (slug: string, task: Partial<TaskMeta["task"]>): TaskMeta => ({
    slug,
    title: slug,
    kind: "page",
    format: "md",
    path: `/tmp/${slug}.md`,
    task: { state: "done", project: "cela", ...task },
  });
  const now = Date.parse("2026-10-28T12:00:00Z");
  const tree = Org.treeOf({
    now,
    projects: [{ key: "cela", name: "Cela", token: "Cela", folder: "/tmp/cela" }],
    sessions: [
      session({ key: "seen", name: "[Cela] sidecar zoom", inView: true }),
      session({ key: "gone", name: "[Cela] sage storybook", inView: false }),
    ],
    tasks: [
      done("today", { doneAt: "2026-10-28T09:00:00Z" }),
      done("yesterday", { doneAt: "2026-10-27T09:00:00Z" }),
      done("removed", { doneAt: "2026-10-28T11:00:00Z", hidden: true }),
      done("untimed", {}),
    ],
  });
  const [cela] = tree.projects;
  assert.deepEqual(
    cela?.done.map((one) => one.meta.slug),
    ["today", "untimed"],
  );
  assert.deepEqual(
    cela?.conversations.map((one) => one.key),
    ["seen"],
  );
  assert.equal(tree.conversations, 1);
});

test("a running task whose Task Leads are idle does not spin, and one spins only while the bus says a lead is doing", () => {
  const running: TaskMeta = {
    slug: "board",
    title: "Board",
    kind: "page",
    format: "md",
    path: "/tmp/board.md",
    task: { state: "running", project: "cela" },
  };
  const input = {
    projects: [{ key: "cela", name: "Cela", token: "Cela", folder: "/tmp/cela" }],
    sessions: [session({ key: "lead", name: "[Cela] TL board build", status: "busy" })],
    tasks: [running],
  };
  const markOf = (tree: ReturnType<typeof Org.treeOf>): string | undefined => tree.projects[0]?.tasks[0]?.mark;
  assert.equal(markOf(Org.treeOf(input)), "completed");
  assert.equal(markOf(Org.treeOf({ ...input, busy: { lead: { doing: true, asking: false } } })), "working");
  assert.equal(markOf(Org.treeOf({ ...input, busy: { lead: { doing: true, asking: true } } })), "needs");
});

test("the org tree puts each role where it works, folds what is done and files your own conversations by their prefix", () => {
  const meta = (slug: string, state: TaskMeta["task"]["state"], project?: string, lead?: string): TaskMeta => ({
    slug,
    title: slug,
    kind: "page",
    format: "md",
    path: `/tmp/${slug}.md`,
    task: { state, ...(project ? { project } : {}), ...(lead ? { lead } : {}) },
  });
  const projects = [
    { key: "cela", name: "Cela", token: "Cela", folder: "/tmp/cela" },
    { key: "meta", name: "meta", token: "meta", folder: "/tmp" },
  ];
  const sessions = [
    session({ key: "ea", name: "[meta] EA daily triage", status: "busy" }),
    session({ key: "pl", name: "[Cela] PL sidecar-task-board plan", status: "waiting" }),
    session({ key: "dl", name: "[Cela] DL sidecar-task-board design" }),
    session({
      key: "fol",
      name: "[Cela] TL sidecar-task-board follower",
      status: "busy",
      agents: [{ name: "designer", color: "blue" }],
    }),
    session({ key: "lane", name: "[Cela] TL sidecar-task-board lane" }),
    session({ key: "loop", name: "[Cela] TL sidecar-task-board loop", live: false }),
    session({ key: "gone", name: "[Cela] TL sidecar-task-board titles", live: false, archived: true }),
    session({ key: "own", name: "contracts guide", status: "busy" }),
    session({ key: "zoom", name: "[Cela] sidecar macOS zoom", status: "waiting" }),
    session({ key: "ops", name: "[Ops] rollout review" }),
  ];
  const tree = Org.treeOf({
    sessions,
    projects,
    asking: ["[Cela] TL sidecar-task-board lane"],
    busy: Object.fromEntries(["ea", "fol", "own"].map((key) => [key, { doing: true, asking: false }])),
    tasks: [
      meta("sidecar-task-board", "running", "cela", "[Cela] TL sidecar-task-board lane"),
      meta("session-title-rule", "done", "cela"),
      meta("settings-hook", "unassigned"),
    ],
  });
  const row = (one: OrgConversation): string => `${one.role} ${one.name} ${one.mark}`;
  assert.deepEqual(tree.assistants.map(row), ["EA daily triage working"]);
  assert.deepEqual(
    tree.inbox.map((one) => one.slug),
    ["settings-hook"],
  );
  const [cela, metaProject] = tree.projects;
  assert.deepEqual(cela?.leads.map(row), [
    "PL sidecar-task-board plan waits",
    "DL sidecar-task-board design completed",
  ]);
  const [board] = cela?.tasks ?? [];
  assert.equal(board?.mark, "needs");
  assert.equal(board?.lead, "lane");
  assert.deepEqual(board?.leads.map(row), ["TL lane needs", "TL follower working"]);
  assert.deepEqual(
    board?.leads.map((one) => one.agents?.map((agent) => agent.name)),
    [undefined, ["designer"]],
  );
  assert.deepEqual(board?.done.map(row), ["TL loop completed"]);
  assert.deepEqual(
    cela?.done.map((one) => one.meta.slug),
    ["session-title-rule"],
  );
  assert.deepEqual(
    cela?.conversations.map((one) => `${one.name} ${one.mark}`),
    ["sidecar macOS zoom waits"],
  );
  assert.equal(cela?.mark, "needs");
  assert.equal(metaProject?.mark, undefined);
  assert.equal(tree.open, 2);
  assert.deepEqual(
    tree.unplaced.map((one) => `${one.role ?? "-"} ${one.name} ${one.mark}`),
    ["- contracts guide working", "- [Ops] rollout review completed"],
  );
  assert.equal(tree.conversations, 9);

  assert.deepEqual(
    ["fol", "dl", "ea", "ops", "nope"].map((key) => {
      const place = Org.placeOf(tree, key);
      return place ? `${place.row.name} ${place.group?.project.key ?? "-"}` : "none";
    }),
    ["follower cela", "sidecar-task-board design cela", "daily triage -", "[Ops] rollout review -", "none"],
  );
  assert.equal(Org.titles(tree).get("[Cela] TL sidecar-task-board follower"), "fol");
  assert.equal(Org.titles(tree).get("[meta] EA daily triage"), "ea");
});

test("a title two conversations share names neither of them", () => {
  const tree = Org.treeOf({
    sessions: [session({ key: "one", name: "[Ops] review" }), session({ key: "two", name: "[Ops] review" })],
    projects: [],
    tasks: [],
  });
  assert.equal(Org.titles(tree).has("[Ops] review"), false);
});

test("a conversation reads the claude agents state off its lane, and off its status without one", () => {
  assert.equal(Tasks.agentStateOf(session({ lane: { name: "blocked" } })), "needs input");
  assert.equal(Tasks.agentStateOf(session({ lane: { name: "working" } })), "working");
  assert.equal(Tasks.agentStateOf(session({ lane: { name: "done" }, status: "busy" })), "completed");
  assert.equal(Tasks.agentStateOf(session({ status: "busy" })), "working");
  assert.equal(Tasks.agentStateOf(session({ status: "idle" })), "completed");
});
