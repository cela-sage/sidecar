import type { ArtifactMeta } from "~~/shared/types/artifact";
import type { HistoryEntry } from "~~/shared/types/history";
import type { LiveSession } from "~~/shared/types/session";
import type { ArtifactTask, TaskState } from "~~/shared/types/task";
import { Titles } from "../../shared/utils/titles.ts";
import { Workstreams } from "../../shared/utils/workstream.ts";
import type { TaskStory } from "./timeline";

// Violet runs on its own, hollow while it waits on someone else, red waits on you, grey is archived.
export type TaskLook = "running" | "waiting" | "needs" | "archived";
export type StepKind = TaskLook | "past" | "future" | "decided";
export type StepJoint = "none" | "solid" | "primary" | "dashed";
export type AgentState = "working" | "needs input" | "idle";

export type TaskMeta = ArtifactMeta & { task: ArtifactTask };

export interface TaskStep {
  label: string;
  kind: StepKind;
  joint: StepJoint;
  tip: string;
  state?: TaskState;
}

const LOOK: Record<TaskState, TaskLook> = {
  unassigned: "waiting",
  assigned: "waiting",
  assessed: "waiting",
  running: "running",
  blocked: "needs",
  waiting: "waiting",
  finished: "needs",
  archived: "archived",
};

const STEP_LABEL: Partial<Record<TaskState, string>> = { unassigned: "Backlog", running: "In progress" };

const TIP: Record<TaskState, string> = {
  unassigned: "Not on a project yet",
  assigned: "On its project, before the Domain Lead reads it",
  assessed: "The Domain Lead read it",
  running: "An Individual Contributor runs it",
  blocked: "The Individual Contributor is blocked on you",
  waiting: "It waits on a third party",
  finished: "The Individual Contributor finished it, and it waits on your mark",
  archived: "Archived is your mark, and it means you checked it and closed it",
};

// Each project keeps its colour from the design, in the order the default lanes come in.
const TINTS = ["blue", "violet", "cyan", "green", "slate"];
const PATH: TaskState[] = ["unassigned", "assigned", "assessed", "running"];
const PRESSING: TaskState[] = [
  "finished",
  "blocked",
  "running",
  "waiting",
  "assessed",
  "assigned",
  "unassigned",
  "archived",
];
const AGENT_ORDER: AgentState[] = ["needs input", "working", "idle"];

const stateBeforeArchive = (entries: HistoryEntry[]): TaskState => {
  for (const entry of entries.toReversed()) {
    if ("move" in entry && entry.move && Workstreams.isArchived(entry.move.now)) return entry.move.was;
  }
  return "finished";
};

const isTask = (meta: ArtifactMeta): meta is TaskMeta => !!meta.task;
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const of = (catalogue: ArtifactMeta[]): TaskMeta[] => catalogue.filter(isTask);

const tintOf = (key: string | undefined, keys: string[]): string => {
  const at = key ? keys.indexOf(key) : -1;
  return at < 0 ? "slate" : (TINTS[at % TINTS.length] ?? "slate");
};

const stepsOf = (state: TaskState, { resumed, settledBy, waiting }: TaskStory = {}): TaskStep[] => {
  const at = PATH.indexOf(state);
  const reached = at < 0 ? PATH.length : at;
  const steps: Omit<TaskStep, "joint">[] = PATH.map((one, i) => ({
    label: STEP_LABEL[one] ?? capital(one),
    kind: i < reached ? "past" : i === reached ? LOOK[one] : "future",
    tip: TIP[one],
    state: one,
  }));
  if (resumed)
    steps.splice(-1, 0, {
      label: `Waited ${resumed.waited}`,
      kind: "past",
      tip: resumed.on ? `Waited on ${resumed.on}` : TIP.waiting,
    });
  if (settledBy)
    steps.push({
      label: settledBy === "YOU" ? "Blocked, settled by you" : "Blocked, settled by the Domain Lead",
      kind: "decided",
      tip: "An escalation stopped it, and the decision is in the history",
    });
  if (state === "blocked") steps.push({ label: "Blocked", kind: LOOK[state], tip: TIP[state] });
  if (state === "finished") steps.push({ label: "Finished", kind: LOOK[state], tip: TIP[state] });
  if (state === "waiting")
    steps.push({ label: waiting?.on ? `Waiting on ${waiting.on}` : "Waiting", kind: LOOK[state], tip: TIP[state] });
  steps.push({
    label: "Archived",
    kind: Workstreams.isArchived(state) ? "archived" : "future",
    tip: TIP.archived,
    state: "archived",
  });
  return steps.map((step, i) => ({
    ...step,
    joint: !i ? "none" : step.kind === "future" ? "dashed" : step.label === STEP_LABEL.running ? "primary" : "solid",
  }));
};

const agentStateOf = (session: LiveSession): AgentState => {
  const lane = session.lane?.name;
  if (lane === "review" || lane === "blocked") return "needs input";
  if (lane === "working") return "working";
  if (lane === "done") return "idle";
  if (session.status === "busy") return "working";
  return session.status === "waiting" ? "needs input" : "idle";
};

const order = (a: TaskMeta, b: TaskMeta): number =>
  PRESSING.indexOf(a.task.state) - PRESSING.indexOf(b.task.state) || a.title.localeCompare(b.title);

const agentOrder = (a: LiveSession, b: LiveSession): number =>
  AGENT_ORDER.indexOf(agentStateOf(a)) - AGENT_ORDER.indexOf(agentStateOf(b)) ||
  (b.lastActive ?? 0) - (a.lastActive ?? 0);

const railOf = (sessions: LiveSession[], slug: string): LiveSession[] =>
  sessions
    .filter((session) => {
      const title =
        (!session.archived || session.life === "alive") && session.name ? Titles.parse(session.name) : undefined;
      return !!title && Titles.belongsTo(title, slug);
    })
    .sort(agentOrder);

export const Tasks = {
  agentOrder,
  agentStateOf,
  of,
  order,
  railOf,
  stateBeforeArchive,
  stepsOf,
  tintOf,
};
