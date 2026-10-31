import type { LiveSession, SessionAgent } from "~~/shared/types/session";
import type { Project, Role, TaskState } from "~~/shared/types/task";
import type { Busy } from "../../shared/utils/busy.ts";
import { Titles, type RoleTitle } from "../../shared/utils/titles.ts";
import { Tasks, type AgentState, type TaskMeta } from "./tasks.ts";

// Amber is a conversation outside a task waiting on you, red a task or its Individual Contributor waiting on you.
export type Mark = "working" | "needs" | "waits" | "third" | "queued" | "unseen" | "completed" | "killed" | "archived";

export interface AgentFace {
  name: string;
  icon: number;
}

export interface OrgConversation {
  key: string;
  title: string;
  name: string;
  role?: Role;
  mark: Mark;
  slug?: string;
  agent?: AgentFace;
  agents?: SessionAgent[];
}

export interface OrgTask {
  meta: TaskMeta;
  status: TaskState;
  mark: Mark;
  leads: OrgConversation[];
}

export interface OrgProject {
  project: Project;
  tint: string;
  mark?: Mark;
  leads: OrgConversation[];
  tasks: OrgTask[];
  archived: OrgTask[];
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
  unseen?: string[];
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
  unseen: Set<string>;
}

interface Placing extends Heard {
  slug?: string;
  waiting?: boolean;
}

const RANK: Record<Mark, number> = {
  needs: 7,
  waits: 6,
  working: 5,
  unseen: 4,
  third: 3,
  queued: 2,
  completed: 1,
  killed: 0,
  archived: 0,
};
const TASK_MARK: Record<TaskState, Mark> = {
  unassigned: "queued",
  assigned: "queued",
  assessed: "queued",
  running: "completed",
  blocked: "needs",
  waiting: "third",
  finished: "needs",
  done: "archived",
};
const LEAD_ORDER: Role[] = ["DL", "SL", "IC"];

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

const finishedOf = (session: LiveSession, { unseen }: Heard): Mark =>
  unseen.has(session.key) ? "unseen" : "completed";

// A process that is gone has no turn to be working or waiting, whatever the bus last heard.
const markOf = (session: LiveSession, heard: Heard, marks: Record<AgentState, Mark>): Mark =>
  session.life === "killed" ? "killed" : marks[stateOf(session, heard)];

const looseOf = (session: LiveSession, heard: Heard, name?: string): OrgConversation => {
  const title = session.name || session.cwd.split("/").filter(Boolean).at(-1) || session.key;
  const marks: Record<AgentState, Mark> = {
    working: "working",
    "needs input": "waits",
    completed: finishedOf(session, heard),
  };
  return { key: session.key, title, name: name ?? title, mark: markOf(session, heard, marks) };
};

const nameOf = ({ title }: Placed, slug?: string): string => {
  const after = title.words.slice(title.words.indexOf(title.role) + 1);
  const words = slug && sameWord(after[0], slug) ? after.slice(1) : after;
  return words.join(" ") || title.rest;
};

const conversationOf = (placed: Placed, { slug, waiting = false, ...heard }: Placing): OrgConversation => {
  const { session, title } = placed;
  const isLead = title.role === "IC";
  const marks: Record<AgentState, Mark> = {
    working: "working",
    "needs input": isLead ? "needs" : "waits",
    completed: waiting && isLead ? "third" : finishedOf(session, heard),
  };
  return {
    key: session.key,
    title: session.name ?? "",
    name: nameOf(placed, slug),
    role: title.role,
    mark: markOf(session, heard, marks),
    ...(slug ? { slug } : {}),
    ...(isLead && session.agents?.length ? { agents: session.agents } : {}),
  };
};

const byLead = (a: Placed, b: Placed): number =>
  LEAD_ORDER.indexOf(a.title.role) - LEAD_ORDER.indexOf(b.title.role) || Tasks.agentOrder(a.session, b.session);

const isKilled = ({ mark }: OrgConversation): boolean => mark === "killed";

const aliveOf = (rows: OrgConversation[]): OrgConversation[] => rows.filter((row) => !isKilled(row));

const byName = (a: OrgConversation, b: OrgConversation): number =>
  Number(isKilled(a)) - Number(isKilled(b)) || (a.agent?.name ?? a.name).localeCompare(b.agent?.name ?? b.name);

const taskOf = (meta: TaskMeta, placed: Placed[], heard: Heard): OrgTask => {
  const placing = { ...heard, slug: meta.slug, waiting: meta.task.state === "waiting" };
  const leads = placed
    .filter((one) => one.title.role === "IC" && Titles.belongsTo(one.title, meta.slug))
    .map((one) => conversationOf(one, placing))
    .sort(byName);
  const alive = aliveOf(leads);
  // A lead with a turn open shows the task In progress whatever its state, and the state returns when the turn ends.
  const status = alive.some((one) => one.mark === "working") ? "running" : meta.task.state;
  const mark = worst([TASK_MARK[status], ...alive.map((one) => one.mark)]) ?? "queued";
  return { meta, status, mark, leads };
};

const projectsOf = (tasks: TaskMeta[], projects: Project[]): Project[] => {
  const known = new Set(projects.map((one) => one.key));
  const strays = new Set(tasks.flatMap((one) => one.task.project ?? []).filter((key) => !known.has(key)));
  return [...projects, ...[...strays].map((key) => ({ key, name: key, token: key, folder: "" }))];
};

const treeOf = ({ sessions, tasks, projects, asking = [], busy = {}, unseen = [] }: OrgInput): OrgTree => {
  const heard: Heard = { asking: new Set(asking), busy, unseen: new Set(unseen) };
  const inView = sessions.some((session) => typeof session.inView === "boolean");
  const listed = sessions.filter((session) =>
    inView ? session.inView : !session.archived || session.life === "alive",
  );
  const placed = placedOf(listed);
  const owned = ownedOf(listed);
  const ordered = [...tasks].sort(Tasks.order);
  const all = projectsOf(ordered, projects);
  const keys = all.map((one) => one.key);

  const groups = all.map((project): OrgProject => {
    const theirs = placed.filter((one) => one.title.role !== "EA" && sameWord(one.title.token, project.token));
    const built = ordered.filter((one) => one.task.project === project.key).map((one) => taskOf(one, theirs, heard));
    const claimed = new Set(built.flatMap((one) => one.leads.map((row) => row.key)));
    const leads = theirs
      .filter((one) => one.title.role !== "IC" || !claimed.has(one.session.key))
      .sort(byLead)
      .map((one) => conversationOf(one, heard));
    const open = built.filter((one) => !Tasks.isArchived(one.status));
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
      archived: built.filter((one) => Tasks.isArchived(one.status)),
      conversations,
    };
  });

  const assistants = placed
    .filter((one) => one.title.role === "EA")
    .sort((a, b) => Tasks.agentOrder(a.session, b.session))
    .map((one) => conversationOf(one, heard));
  const placedRows = groups.flatMap((group) => [
    ...group.leads,
    ...[...group.tasks, ...group.archived].flatMap((one) => one.leads),
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
    open: tasks.filter((one) => !Tasks.isArchived(one.task.state)).length,
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
      ...[...group.tasks, ...group.archived].flatMap((one) => one.leads),
      ...group.conversations,
    ];
    const row = rows.find(is);
    if (row) return { row, group };
  }
  const row = [...tree.assistants, ...tree.unplaced].find(is);
  return row ? { row } : undefined;
};

const everyone = (tree: OrgTree): OrgConversation[] => [
  ...tree.assistants,
  ...tree.projects.flatMap((group) => [...group.leads, ...group.tasks.flatMap((one) => aliveOf(one.leads))]),
  ...tree.unplaced,
];

const mentionable = (tree: OrgTree, key: string): OrgConversation[] => {
  const group = placeOf(tree, key)?.group;
  const rows = group
    ? [...group.leads, ...group.tasks.flatMap((one) => aliveOf(one.leads)), ...group.conversations]
    : everyone(tree);
  return rows.filter((row) => row.key !== key);
};

const statusOf = (tree: OrgTree, slug: string): TaskState | undefined =>
  tree.projects.flatMap((group) => [...group.tasks, ...group.archived]).find((one) => one.meta.slug === slug)?.status;

const conversationsOf = (tree: OrgTree): OrgConversation[] => [
  ...tree.assistants,
  ...tree.unplaced,
  ...tree.projects.flatMap((group) => [
    ...group.leads,
    ...[...group.tasks, ...group.archived].flatMap((one) => one.leads),
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

export const Org = { aliveOf, everyone, mentionable, placeOf, statusOf, titles, treeOf };
