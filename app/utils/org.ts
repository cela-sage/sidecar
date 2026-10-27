import type { LiveSession } from "~~/shared/types/session";
import type { Project, Role, TaskState } from "~~/shared/types/task";
import { Titles, type RoleTitle } from "../../shared/utils/titles.ts";
import { Tasks, type AgentState, type TaskMeta } from "./tasks.ts";

// Amber is a conversation outside a task waiting on you, red a task or its Task Lead waiting on you.
export type Mark = "working" | "needs" | "waits" | "third" | "queued" | "completed" | "done";

export interface OrgConversation {
  key: string;
  title: string;
  name: string;
  role: Role;
  mark: Mark;
  slug?: string;
}

export interface OrgTask {
  meta: TaskMeta;
  mark: Mark;
  lead?: string;
  leads: OrgConversation[];
  done: OrgConversation[];
}

export interface OrgProject {
  project: Project;
  tint: string;
  mark?: Mark;
  leads: OrgConversation[];
  tasks: OrgTask[];
  done: OrgTask[];
}

export interface OrgTree {
  assistants: OrgConversation[];
  inbox: TaskMeta[];
  projects: OrgProject[];
  open: number;
  conversations: number;
}

export interface OrgInput {
  sessions: LiveSession[];
  tasks: TaskMeta[];
  projects: Project[];
  asking?: string[];
}

interface Placed {
  session: LiveSession;
  title: RoleTitle & { role: Role };
}

interface Placing {
  asking: Set<string>;
  slug?: string;
  waiting?: boolean;
}

const RANK: Record<Mark, number> = { needs: 6, waits: 5, working: 4, third: 3, queued: 2, completed: 1, done: 0 };
const TASK_MARK: Record<TaskState, Mark> = {
  unassigned: "queued",
  assigned: "queued",
  assessed: "queued",
  running: "working",
  blocked: "needs",
  waiting: "third",
  done: "done",
};
const LEAD_ORDER: Role[] = ["PL", "DL", "TL"];

const worst = (marks: Mark[]): Mark | undefined =>
  marks.reduce<Mark | undefined>((was, one) => (!was || RANK[one] > RANK[was] ? one : was), undefined);

const sameWord = (a = "", b = ""): boolean => a.toLowerCase() === b.toLowerCase();

const placedOf = (sessions: LiveSession[]): Placed[] =>
  sessions.flatMap((session) => {
    const title = (!session.archived || session.live) && session.name ? Titles.parse(session.name) : undefined;
    return title?.role ? [{ session, title: { ...title, role: title.role } }] : [];
  });

const nameOf = ({ title }: Placed, slug?: string): string => {
  const after = title.words.slice(title.words.indexOf(title.role) + 1);
  const words = slug && sameWord(after[0], slug) ? after.slice(1) : after;
  return words.join(" ") || title.rest;
};

const conversationOf = (placed: Placed, { asking, slug, waiting = false }: Placing): OrgConversation => {
  const { session, title } = placed;
  const isLead = title.role === "TL";
  const state = asking.has(session.name ?? "") ? "needs input" : Tasks.agentStateOf(session);
  const marks: Record<AgentState, Mark> = {
    working: "working",
    "needs input": isLead ? "needs" : "waits",
    completed: waiting && isLead ? "third" : "completed",
  };
  return {
    key: session.key,
    title: session.name ?? "",
    name: nameOf(placed, slug),
    role: title.role,
    mark: marks[state],
    ...(slug ? { slug } : {}),
  };
};

const byLead = (a: Placed, b: Placed): number =>
  LEAD_ORDER.indexOf(a.title.role) - LEAD_ORDER.indexOf(b.title.role) || Tasks.agentOrder(a.session, b.session);

const taskOf = (meta: TaskMeta, placed: Placed[], asking: Set<string>): OrgTask => {
  const mine = placed.filter((one) => one.title.role === "TL" && Titles.belongsTo(one.title, meta.slug)).sort(byLead);
  const placing = { asking, slug: meta.slug, waiting: meta.task.state === "waiting" };
  const leads = mine
    .filter((one) => one.session.live)
    .map((one) => conversationOf(one, placing))
    .sort((a, b) => RANK[b.mark] - RANK[a.mark]);
  const done = mine.filter((one) => !one.session.live).map((one) => conversationOf(one, placing));
  const lead = mine.find((one) => one.session.name === meta.task.lead)?.session.key ?? leads[0]?.key;
  const mark = worst([TASK_MARK[meta.task.state], ...leads.map((one) => one.mark)]) ?? "queued";
  return { meta, mark, ...(lead ? { lead } : {}), leads, done };
};

const projectsOf = (tasks: TaskMeta[], projects: Project[]): Project[] => {
  const known = new Set(projects.map((one) => one.key));
  const strays = new Set(tasks.flatMap((one) => one.task.project ?? []).filter((key) => !known.has(key)));
  return [...projects, ...[...strays].map((key) => ({ key, name: key, token: key, folder: "" }))];
};

const treeOf = ({ sessions, tasks, projects, asking = [] }: OrgInput): OrgTree => {
  const asked = new Set(asking);
  const placed = placedOf(sessions);
  const ordered = [...tasks].sort(Tasks.order);
  const all = projectsOf(ordered, projects);
  const keys = all.map((one) => one.key);

  const groups = all.map((project): OrgProject => {
    const theirs = placed.filter((one) => one.title.role !== "EA" && sameWord(one.title.token, project.token));
    const built = ordered.filter((one) => one.task.project === project.key).map((one) => taskOf(one, theirs, asked));
    const claimed = new Set(built.flatMap((one) => [...one.leads, ...one.done].map((row) => row.key)));
    const leads = theirs
      .filter((one) => one.title.role !== "TL" || !claimed.has(one.session.key))
      .sort(byLead)
      .map((one) => conversationOf(one, { asking: asked }));
    const open = built.filter((one) => one.meta.task.state !== "done");
    return {
      project,
      tint: Tasks.tintOf(project.key, keys),
      mark: worst([...leads, ...open].map((one) => one.mark)),
      leads,
      tasks: open,
      done: built.filter((one) => one.meta.task.state === "done"),
    };
  });

  const assistants = placed
    .filter((one) => one.title.role === "EA")
    .sort((a, b) => Tasks.agentOrder(a.session, b.session))
    .map((one) => conversationOf(one, { asking: asked }));
  const placedRows = groups.flatMap((group) => [
    ...group.leads,
    ...[...group.tasks, ...group.done].flatMap((one) => [...one.leads, ...one.done]),
  ]);
  return {
    assistants,
    inbox: ordered.filter((one) => one.task.state === "unassigned"),
    projects: groups,
    open: tasks.filter((one) => one.task.state !== "done").length,
    conversations: assistants.length + placedRows.length,
  };
};

export const Org = { treeOf };
