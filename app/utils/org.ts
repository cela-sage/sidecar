import type { LiveSession, SessionAgent } from "~~/shared/types/session";
import type { Project, Role, TaskState } from "~~/shared/types/task";
import type { Busy } from "../../shared/utils/busy.ts";
import { Titles, type RoleTitle } from "../../shared/utils/titles.ts";
import { Tasks, type AgentState, type TaskMeta } from "./tasks.ts";

// Amber is a conversation outside a task waiting on you, red a task or its Task Lead waiting on you.
export type Mark = "working" | "needs" | "waits" | "third" | "queued" | "completed" | "done";

export interface OrgConversation {
  key: string;
  title: string;
  name: string;
  role?: Role;
  mark: Mark;
  slug?: string;
  agents?: SessionAgent[];
}

export interface OrgTask {
  meta: TaskMeta;
  status: TaskState;
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
  conversations: OrgConversation[];
}

export interface OrgTree {
  assistants: OrgConversation[];
  inbox: TaskMeta[];
  projects: OrgProject[];
  unplaced: OrgConversation[];
  open: number;
  conversations: number;
}

export interface OrgInput {
  sessions: LiveSession[];
  tasks: TaskMeta[];
  projects: Project[];
  asking?: string[];
  busy?: Record<string, Busy>;
  now?: number;
}

interface Placed {
  session: LiveSession;
  title: RoleTitle & { role: Role };
}

interface Owned {
  session: LiveSession;
  title: RoleTitle;
}

interface Heard {
  asking: Set<string>;
  busy: Record<string, Busy>;
}

interface Placing extends Heard {
  slug?: string;
  waiting?: boolean;
}

const RANK: Record<Mark, number> = { needs: 6, waits: 5, working: 4, third: 3, queued: 2, completed: 1, done: 0 };
const TASK_MARK: Record<TaskState, Mark> = {
  unassigned: "queued",
  assigned: "queued",
  assessed: "queued",
  running: "completed",
  blocked: "needs",
  waiting: "third",
  finished: "needs",
  done: "done",
};
const LEAD_ORDER: Role[] = ["PL", "DL", "TL"];
const DONE_KEPT_MS = 24 * 60 * 60_000;

const isShown = ({ task }: TaskMeta, now: number): boolean =>
  task.state !== "done" || (!task.hidden && !(task.doneAt && now - Date.parse(task.doneAt) > DONE_KEPT_MS));

const worst = (marks: Mark[]): Mark | undefined =>
  marks.reduce<Mark | undefined>((was, one) => (!was || RANK[one] > RANK[was] ? one : was), undefined);

const sameWord = (a = "", b = ""): boolean => a.toLowerCase() === b.toLowerCase();

const placedOf = (sessions: LiveSession[]): Placed[] =>
  sessions.flatMap((session) => {
    const title = session.name ? Titles.parse(session.name) : undefined;
    return title?.role ? [{ session, title: { ...title, role: title.role } }] : [];
  });

const ownedOf = (sessions: LiveSession[]): Owned[] =>
  sessions.flatMap((session) => {
    const title = session.name ? Titles.parse(session.name) : undefined;
    return title && !title.role ? [{ session, title }] : [];
  });

// Only the turn bus knows a turn is open, so a polled "working" says nothing and reads as completed.
const stateOf = (session: LiveSession, { asking, busy }: Heard): AgentState => {
  const bus = busy[session.key];
  if (bus?.asking || asking.has(session.name ?? "")) return "needs input";
  if (bus?.doing) return "working";
  const polled = Tasks.agentStateOf(session);
  return polled === "working" ? "completed" : polled;
};

const looseOf = (session: LiveSession, heard: Heard, name?: string): OrgConversation => {
  const title = session.name || session.cwd.split("/").filter(Boolean).at(-1) || session.key;
  const state = stateOf(session, heard);
  const marks: Record<AgentState, Mark> = { working: "working", "needs input": "waits", completed: "completed" };
  return { key: session.key, title, name: name ?? title, mark: marks[state] };
};

const nameOf = ({ title }: Placed, slug?: string): string => {
  const after = title.words.slice(title.words.indexOf(title.role) + 1);
  const words = slug && sameWord(after[0], slug) ? after.slice(1) : after;
  return words.join(" ") || title.rest;
};

const conversationOf = (placed: Placed, { slug, waiting = false, ...heard }: Placing): OrgConversation => {
  const { session, title } = placed;
  const isLead = title.role === "TL";
  const state = stateOf(session, heard);
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
    ...(isLead && session.agents?.length ? { agents: session.agents } : {}),
  };
};

const byLead = (a: Placed, b: Placed): number =>
  LEAD_ORDER.indexOf(a.title.role) - LEAD_ORDER.indexOf(b.title.role) || Tasks.agentOrder(a.session, b.session);

const taskOf = (meta: TaskMeta, placed: Placed[], heard: Heard): OrgTask => {
  const mine = placed.filter((one) => one.title.role === "TL" && Titles.belongsTo(one.title, meta.slug)).sort(byLead);
  const placing = { ...heard, slug: meta.slug, waiting: meta.task.state === "waiting" };
  const leads = mine
    .filter((one) => one.session.live)
    .map((one) => conversationOf(one, placing))
    .sort((a, b) => RANK[b.mark] - RANK[a.mark]);
  const done = mine.filter((one) => !one.session.live).map((one) => conversationOf(one, placing));
  const lead = mine.find((one) => one.session.name === meta.task.lead)?.session.key ?? leads[0]?.key;
  // A lead with a turn open shows the task In progress whatever its state, and the state returns when the turn ends.
  const status = leads.some((one) => one.mark === "working") ? "running" : meta.task.state;
  const mark = worst([TASK_MARK[status], ...leads.map((one) => one.mark)]) ?? "queued";
  return { meta, status, mark, ...(lead ? { lead } : {}), leads, done };
};

const projectsOf = (tasks: TaskMeta[], projects: Project[]): Project[] => {
  const known = new Set(projects.map((one) => one.key));
  const strays = new Set(tasks.flatMap((one) => one.task.project ?? []).filter((key) => !known.has(key)));
  return [...projects, ...[...strays].map((key) => ({ key, name: key, token: key, folder: "" }))];
};

const treeOf = ({ sessions, tasks, projects, asking = [], busy = {}, now = Date.now() }: OrgInput): OrgTree => {
  const heard: Heard = { asking: new Set(asking), busy };
  const inView = sessions.some((session) => typeof session.inView === "boolean");
  const listed = sessions.filter((session) => (inView ? session.inView : !session.archived || session.live));
  const placed = placedOf(listed);
  const owned = ownedOf(listed);
  const ordered = tasks.filter((one) => isShown(one, now)).sort(Tasks.order);
  const all = projectsOf(ordered, projects);
  const keys = all.map((one) => one.key);

  const groups = all.map((project): OrgProject => {
    const theirs = placed.filter((one) => one.title.role !== "EA" && sameWord(one.title.token, project.token));
    const built = ordered.filter((one) => one.task.project === project.key).map((one) => taskOf(one, theirs, heard));
    const claimed = new Set(built.flatMap((one) => [...one.leads, ...one.done].map((row) => row.key)));
    const leads = theirs
      .filter((one) => one.title.role !== "TL" || !claimed.has(one.session.key))
      .sort(byLead)
      .map((one) => conversationOf(one, heard));
    const open = built.filter((one) => one.status !== "done");
    const conversations = owned
      .filter((one) => sameWord(one.title.token, project.token))
      .sort((a, b) => Tasks.agentOrder(a.session, b.session))
      .map((one) => looseOf(one.session, heard, one.title.rest));
    return {
      project,
      tint: Tasks.tintOf(project.key, keys),
      mark: worst([...leads, ...open, ...conversations].map((one) => one.mark)),
      leads,
      tasks: open,
      done: built.filter((one) => one.status === "done"),
      conversations,
    };
  });

  const assistants = placed
    .filter((one) => one.title.role === "EA")
    .sort((a, b) => Tasks.agentOrder(a.session, b.session))
    .map((one) => conversationOf(one, heard));
  const placedRows = groups.flatMap((group) => [
    ...group.leads,
    ...[...group.tasks, ...group.done].flatMap((one) => [...one.leads, ...one.done]),
    ...group.conversations,
  ]);
  const seen = new Set([...assistants, ...placedRows].map((row) => row.key));
  const unplaced = listed
    .filter((session) => !seen.has(session.key))
    .sort(Tasks.agentOrder)
    .map((session) => {
      const role = placed.find((one) => one.session.key === session.key);
      return role ? conversationOf(role, heard) : looseOf(session, heard);
    });
  return {
    assistants,
    inbox: ordered.filter((one) => one.task.state === "unassigned"),
    projects: groups,
    unplaced,
    open: tasks.filter((one) => one.task.state !== "done").length,
    conversations: seen.size + unplaced.length,
  };
};

export interface OrgPlace {
  row: OrgConversation;
  group?: OrgProject;
}

const placeOf = (tree: OrgTree, key: string): OrgPlace | undefined => {
  const is = (row: OrgConversation): boolean => row.key === key;
  for (const group of tree.projects) {
    const rows = [
      ...group.leads,
      ...[...group.tasks, ...group.done].flatMap((one) => [...one.leads, ...one.done]),
      ...group.conversations,
    ];
    const row = rows.find(is);
    if (row) return { row, group };
  }
  const row = [...tree.assistants, ...tree.unplaced].find(is);
  return row ? { row } : undefined;
};

const statusOf = (tree: OrgTree, slug: string): TaskState | undefined =>
  tree.projects.flatMap((group) => [...group.tasks, ...group.done]).find((one) => one.meta.slug === slug)?.status;

const conversationsOf = (tree: OrgTree): OrgConversation[] => [
  ...tree.assistants,
  ...tree.unplaced,
  ...tree.projects.flatMap((group) => [
    ...group.leads,
    ...[...group.tasks, ...group.done].flatMap((one) => [...one.leads, ...one.done]),
    ...group.conversations,
  ]),
];

const titles = (tree: OrgTree): Map<string, string> => {
  const keys = new Map<string, string | undefined>();
  for (const { key, title } of conversationsOf(tree)) {
    if (!keys.has(title)) keys.set(title, key);
    else if (keys.get(title) !== key) keys.set(title, undefined);
  }
  return new Map([...keys].flatMap(([title, key]) => (title && key ? [[title, key] as const] : [])));
};

export const Org = { placeOf, statusOf, titles, treeOf };
