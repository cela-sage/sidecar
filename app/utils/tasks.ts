import type { ArtifactMeta } from "~~/shared/types/artifact";
import type { LiveSession } from "~~/shared/types/session";
import type { ArtifactTask, TaskState } from "~~/shared/types/task";

// Violet runs on its own, hollow while it waits on someone else, red waits on you, grey is done.
export type TaskLook = "running" | "waiting" | "needs" | "done";
export type StepKind = TaskLook | "past" | "future";
export type StepJoint = "none" | "solid" | "primary" | "dashed";
export type AgentState = "working" | "needs input" | "completed";
export type Role = "EA" | "PL" | "DL" | "TL";

export type TaskMeta = ArtifactMeta & { task: ArtifactTask };

export interface TaskStep {
  label: string;
  kind: StepKind;
  joint: StepJoint;
  tip: string;
}

export interface RoleTitle {
  token: string;
  rest: string;
  role?: Role;
  words: string[];
}

export interface TaskSummary {
  text: string;
  look?: TaskLook;
}

const LOOK: Record<TaskState, TaskLook> = {
  unassigned: "waiting",
  assigned: "waiting",
  assessed: "waiting",
  running: "running",
  blocked: "needs",
  waiting: "waiting",
  done: "done",
};

const LABEL: Record<TaskState, string> = {
  unassigned: "unassigned",
  assigned: "assigned",
  assessed: "assessed",
  running: "running",
  blocked: "needs you",
  waiting: "waiting",
  done: "done",
};

const TIP: Record<TaskState, string> = {
  unassigned: "Not on a project yet",
  assigned: "On its project, before the Project Lead reads it",
  assessed: "The Project Lead read it",
  running: "A Task Lead runs it",
  blocked: "The Task Lead is blocked on you",
  waiting: "It waits on a third party",
  done: "Finished",
};

// Each project keeps its colour from the design, in the order the default lanes come in.
const TINTS = ["blue", "violet", "cyan", "green", "slate"];
const PATH: TaskState[] = ["unassigned", "assigned", "assessed", "running"];
const PRESSING: TaskState[] = ["blocked", "running", "waiting", "assessed", "assigned", "unassigned", "done"];
const ROLES: Role[] = ["EA", "PL", "DL", "TL"];
const AGENT_ORDER: AgentState[] = ["needs input", "working", "completed"];

const isTask = (meta: ArtifactMeta): meta is TaskMeta => !!meta.task;
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const lookOf = (state: TaskState): TaskLook => LOOK[state];
const labelOf = (state: TaskState): string => LABEL[state];
const chipOf = (state: TaskState): string => capital(LABEL[state]);

const of = (catalogue: ArtifactMeta[]): TaskMeta[] => catalogue.filter(isTask);

function tintOf(key: string | undefined, keys: string[]): string {
  const at = key ? keys.indexOf(key) : -1;
  return at < 0 ? "slate" : (TINTS[at % TINTS.length] ?? "slate");
}

function stepsOf(state: TaskState): TaskStep[] {
  const at = PATH.indexOf(state);
  const reached = at < 0 ? PATH.length : at;
  const steps: Omit<TaskStep, "joint">[] = PATH.map((one, i) => ({
    label: capital(one),
    kind: i < reached ? "past" : i === reached ? LOOK[one] : "future",
    tip: TIP[one],
  }));
  if (state === "blocked" || state === "waiting")
    steps.push({ label: chipOf(state), kind: LOOK[state], tip: TIP[state] });
  steps.push({ label: "Done", kind: state === "done" ? "done" : "future", tip: TIP.done });
  return steps.map((step, i) => ({
    ...step,
    joint: !i ? "none" : step.kind === "future" ? "dashed" : step.label === "Running" ? "primary" : "solid",
  }));
}

function summaryOf(tasks: TaskMeta[]): TaskSummary {
  for (const state of PRESSING) {
    const count = tasks.filter((one) => one.task.state === state).length;
    if (count) return { text: `${count} ${LABEL[state]}`, look: LOOK[state] };
  }
  return { text: "nothing open" };
}

function parseTitle(name: string): RoleTitle | undefined {
  const hit = /^\[([^\]]+)\]\s+(.+)$/.exec(name.trim());
  if (!hit?.[1] || !hit[2]) return undefined;
  const words = hit[2].split(/\s+/);
  return { token: hit[1], rest: hit[2], role: ROLES.find((role) => words.includes(role)), words };
}

// The ticket before the role token, or the slug after it, names the task, the way the title rule writes it.
function belongsTo(title: RoleTitle, slug: string): boolean {
  if (!title.role) return false;
  const at = title.words.indexOf(title.role);
  return title.words.slice(0, at + 2).some((word) => word.toLowerCase() === slug.toLowerCase());
}

function agentStateOf(session: LiveSession): AgentState {
  const lane = session.lane?.name;
  if (lane === "review" || lane === "blocked") return "needs input";
  if (lane === "working") return "working";
  if (lane === "done") return "completed";
  if (session.status === "busy") return "working";
  return session.status === "waiting" ? "needs input" : "completed";
}

const order = (a: TaskMeta, b: TaskMeta): number =>
  PRESSING.indexOf(a.task.state) - PRESSING.indexOf(b.task.state) || a.title.localeCompare(b.title);

const agentOrder = (a: LiveSession, b: LiveSession): number =>
  AGENT_ORDER.indexOf(agentStateOf(a)) - AGENT_ORDER.indexOf(agentStateOf(b)) ||
  (b.lastActive ?? 0) - (a.lastActive ?? 0);

export const Tasks = {
  agentOrder,
  agentStateOf,
  belongsTo,
  chipOf,
  labelOf,
  lookOf,
  of,
  order,
  parseTitle,
  stepsOf,
  summaryOf,
  tintOf,
};
