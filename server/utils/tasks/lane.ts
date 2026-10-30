import { readFileSync } from "node:fs";
import * as Events from "../../../lib/sidecar/events.ts";
import { Refusal } from "../../../lib/sidecar/refusal.ts";
import { Threads, type Thread } from "../../../lib/sidecar/threads.ts";
import type { HistoryEntry, Move, Said } from "../../../shared/types/history.ts";
import type { AskKind, TaskAsk, TaskState } from "../../../shared/types/task.ts";
import { Parts } from "../../../shared/utils/parts.ts";
import { Titles } from "../../../shared/utils/titles.ts";
import { Projects } from "../projects.ts";
import { deliver } from "../sessions/inbox.ts";
import { Ask } from "./ask.ts";
import { TaskCaller, type Caller } from "./caller.ts";
import { TaskFiles, type TaskFile } from "./file.ts";
import { TaskHistory } from "./history.ts";
import { TaskShelf } from "./shelf.ts";
import { TaskTrash } from "./trash.ts";
import { liveSessions } from "../sessions/index.ts";
import { removeSession } from "../sessions/removal.ts";
import type { LiveSession } from "../../../shared/types/session.ts";

export interface StateInput {
  given: string;
  caller: Caller;
  state: TaskState;
  reason?: string;
  on?: string;
}

export interface AskInput {
  given: string;
  caller: Caller;
  kind: AskKind;
  text: string;
  options?: string[];
  quote?: string;
}

export interface JudgeInput {
  given: string;
  caller: Caller;
  verdict: string;
  pick?: number;
  thread?: string;
  settle?: boolean;
}

export interface Judged {
  file: TaskFile;
  decided?: Decided;
}

export interface DecideInput {
  given: string;
  caller: Caller;
  answer: string;
  thread?: string;
}

export type AskThread = Thread & { ask: TaskAsk };

export interface Asked {
  file: TaskFile;
  thread: AskThread;
  decisions: HistoryEntry[];
}

export interface Decided {
  file: TaskFile;
  question: string;
  ask: TaskAsk;
  text: string;
}

export interface Read {
  file: TaskFile;
  entries: HistoryEntry[];
  asks: AskThread[];
}

const HIRE = ["Approve", "Refuse"];
const H2 = /^##[ \t]+(.+?)[ \t#]*$/;

const now = (): string => new Date().toISOString();
const uid8 = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 8);
const saidBy = (caller: Caller): Said => ({
  at: now(),
  who: caller.who,
  ...(caller.from ? { from: caller.from } : {}),
});

const changed = (file: TaskFile): void =>
  Events.publish({ topic: "task.changed", data: { slug: file.slug, state: file.task.state } });

const record = (file: TaskFile, entry: HistoryEntry): void => {
  TaskHistory.append(file.slug, entry);
  changed(file);
};

const move = (file: TaskFile, now: TaskState): { file: TaskFile; move?: Move } => {
  const was = file.task.state;
  if (was === now) return { file };
  return { file: TaskFiles.restamp(file, { ...file.task, state: now }), move: { was, now } };
};

// Done is Marco's mark, so a lead's done files the task finished for him to check and never undoes a mark he gave.
const reached = (was: TaskState, asked: TaskState, caller: Caller): TaskState => {
  if (asked !== "done" || caller.who === "YOU") return asked;
  return was === "done" ? was : "finished";
};

const state = ({ given, caller, state: asked, reason, on }: StateInput): TaskFile => {
  const file = TaskFiles.open(given);
  if (asked === "waiting" && !reason) throw new Refusal("waiting needs --reason, what the task waits for", 2);
  if (!file.task.project && asked !== "unassigned")
    throw new Refusal(
      `${file.slug} is on no project, so it cannot be ${asked}. Give it one: sidecar task ${file.slug} assign <project>`,
      2,
    );
  const was = file.task.state;
  const now = reached(was, asked, caller);
  if (was === now && !reason) return file;
  const task = { ...file.task, state: now, ...(now === "unassigned" ? { project: undefined } : {}) };
  const next = TaskFiles.restamp(file, task);
  if (now !== "done") TaskShelf.show(file.slug);
  record(next, {
    ...saidBy(caller),
    kind: "state",
    move: { was, now },
    ...(reason ? { reason } : {}),
    ...(on ? { on } : {}),
  });
  return next;
};

const create = (title: string): TaskFile => {
  const file = TaskFiles.create(title);
  changed(file);
  return file;
};

const leadsOf = (sessions: LiveSession[], slug: string): LiveSession[] =>
  sessions.filter((one) => {
    const title = (!one.archived || one.life === "alive") && one.name ? Titles.parse(one.name) : undefined;
    return title?.role === "TL" && Titles.belongsTo(title, slug);
  });

// A Task Lead goes the way a conversation's delete takes it, so its process ends while its transcript stays on disk.
const remove = async ({ given, caller }: { given: string; caller: Caller }): Promise<{ stopped: string[] }> => {
  const file = TaskFiles.open(given);
  if (!TaskTrash.holds(file)) throw new Refusal(`${file.slug} lives outside the artifacts, so it stays`, 2);
  const stopped: string[] = [];
  for (const lead of leadsOf(liveSessions(), file.slug)) {
    const outcome = await removeSession(lead.key);
    const done = stopped.length ? `, after stopping ${stopped.join(", ")}` : "";
    if (outcome.refused)
      throw new Refusal(`${lead.name} did not stop: ${outcome.refused}${done}, so the task stays`, 2);
    stopped.push(lead.name ?? lead.key);
  }
  record(file, { ...saidBy(caller), kind: "remove", stopped });
  TaskTrash.trash(file);
  return { stopped };
};

const rename = ({ given, caller, title }: { given: string; caller: Caller; title: string }): TaskFile => {
  const file = TaskFiles.open(given);
  const now = title.trim();
  if (!now || now.includes("\n"))
    throw new Refusal('rename needs the new title in quotes, on one line: rename "<title>"', 2);
  if (now === file.title) return file;
  const next = TaskFiles.retitle(file, now);
  record(next, { ...saidBy(caller), kind: "rename", was: file.title, now });
  return next;
};

const assign = ({ given, caller, project }: { given: string; caller: Caller; project: string }): TaskFile => {
  const file = TaskFiles.open(given);
  const projects = Projects.list();
  const hit = projects.find((one) => [one.key, one.name.toLowerCase()].includes(project.toLowerCase()));
  if (!hit) throw new Refusal(`no project '${project}'. One of: ${projects.map((one) => one.key).join(", ")}`, 2);
  const was = file.task.state;
  const now = was === "unassigned" ? "assigned" : was;
  const next = TaskFiles.restamp(file, { ...file.task, project: hit.key, state: now });
  record(next, { ...saidBy(caller), kind: "assign", project: hit.key, ...(was === now ? {} : { move: { was, now } }) });
  return next;
};

const sectionOf = (text: string, quote: string): string | undefined => {
  const at = text.indexOf(quote);
  if (at < 0) return undefined;
  const headings = text
    .slice(0, at)
    .split("\n")
    .flatMap((line) => H2.exec(line)?.[1] ?? []);
  return headings.at(-1);
};

const asksOf = (threads: Thread[]): AskThread[] =>
  threads.flatMap((one) => {
    const ask = Ask.parse(one.ask);
    return ask ? [{ ...one, ask }] : [];
  });

const decisionsOf = (slug: string): HistoryEntry[] =>
  TaskHistory.read(slug).filter((entry) => entry.kind === "decide" && entry.who === "YOU");

const escalate = ({ given, caller, kind, text, options = [], quote }: AskInput): Asked => {
  const opened = TaskFiles.open(given);
  const doc = Threads.read(opened.path);
  const at = now();
  const label = quote ? sectionOf(readFileSync(opened.path, "utf8"), quote) : undefined;
  const ask: TaskAsk = {
    kind,
    ...(caller.from ? { from: caller.from } : {}),
    options: kind === "hire" ? HIRE : options,
  };
  const thread: AskThread = {
    id: uid8(),
    n: doc.threads.reduce((max, one) => Math.max(max, Number(one.n) || 0), 0) + 1,
    by: "claude",
    at,
    updated: at,
    body: text,
    status: "open",
    ...(quote ? { anchor: { quote, ...(label ? { label } : {}) } } : {}),
    replies: [],
    ask,
  };
  Threads.write(opened.path, { ...doc, updated: at, threads: [...doc.threads, thread] });
  const blocks = kind === "escalation" && !!opened.task.project;
  const { file, move: moved } = blocks ? move(opened, "blocked") : { file: opened };
  TaskHistory.append(file.slug, {
    ...saidBy(caller),
    kind: "ask",
    thread: String(thread.id),
    ask: kind,
    text,
    options: ask.options,
    ...(moved ? { move: moved } : {}),
  });
  Events.publish({
    topic: "task.escalated",
    data: { slug: file.slug, title: file.title, thread: String(thread.id), kind, question: text },
  });
  return { file, thread, decisions: decisionsOf(file.slug) };
};

const pending = (threads: Thread[], n?: string): AskThread => {
  const asks = asksOf(threads);
  const [newest] = asks
    .filter((one) => one.status !== "resolved")
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const hit = n ? asks.find((one) => String(one.n) === n || one.id === n) : newest;
  if (!hit)
    throw new Refusal(n ? `no escalation or hire #${n} on this task` : "nothing on this task waits on a decision", 2);
  if (hit.status === "resolved")
    throw new Refusal(`#${n} is settled already${hit.ask.decision?.who === "PL" ? " by the Project Lead" : ""}`, 2);
  return hit;
};

const replace = (threads: Thread[], thread: Thread): Thread[] =>
  threads.map((one) => (one.id === thread.id ? thread : one));

const pickOf = (options: string[], given?: number): number | undefined => {
  if (!given) return undefined;
  if (!Number.isInteger(given) || given < 1 || given > options.length)
    throw new Refusal(options.length ? `pick one of 1 to ${options.length}` : "this one has no options to pick", 2);
  return given;
};

const answerOf = (ask: TaskAsk, question: string, answer: string): { text: string; option?: number } => {
  const option = /^\d+$/.test(answer.trim()) ? pickOf(ask.options, Number(answer)) : undefined;
  if (!option) return { text: answer.trim() };
  if (ask.kind === "hire") return { text: `${option === 1 ? "Approved" : "Refused"}: ${question}`, option };
  return { text: ask.options[option - 1] ?? answer, option };
};

const unblocked = (opened: TaskFile, threads: Thread[], thread: AskThread): { file: TaskFile; move?: Move } => {
  const stillBlocked = asksOf(threads).some((one) => one.status !== "resolved" && one.ask.kind === "escalation");
  const unblocks = thread.ask.kind === "escalation" && opened.task.state === "blocked" && !stillBlocked;
  return unblocks ? move(opened, "running") : { file: opened };
};

// Bare, --settle settles the verdict already standing, so a Task Lead can close one the Project Lead judged.
const judge = ({ given, caller, verdict, pick, thread: n, settle = false }: JudgeInput): Judged => {
  const opened = TaskFiles.open(given);
  const doc = Threads.read(opened.path);
  const thread = pending(doc.threads, n);
  const at = now();
  const said = verdict.trim();
  const standing = !said && settle ? thread.ask.verdict : undefined;
  if (!said && !standing) throw new Refusal('judge needs the verdict in quotes: judge "<verdict>" --pick <n>', 2);
  const chosen = pickOf(thread.ask.options, pick ?? standing?.pick);
  const judged = standing ?? {
    ...(caller.from ? { from: caller.from } : {}),
    text: said,
    ...(chosen ? { pick: chosen } : {}),
    at,
  };
  const question = String(thread.body ?? "");
  const { text, option } = chosen ? answerOf(thread.ask, question, String(chosen)) : { text: judged.text };
  const lead: Caller = { who: "PL", ...(judged.from ? { from: judged.from } : {}) };
  const ask: TaskAsk = {
    ...thread.ask,
    verdict: judged,
    ...(settle ? { decision: { ...saidBy(lead), text, ...(option ? { option } : {}), at } } : {}),
  };
  const threads = replace(doc.threads, {
    ...thread,
    ask,
    updated: at,
    ...(settle ? { status: "resolved", resolvedBy: "claude" } : {}),
  });
  Threads.write(opened.path, { ...doc, updated: at, threads });
  const { file, move: moved } = settle ? unblocked(opened, threads, thread) : { file: opened };
  record(file, {
    ...saidBy(caller),
    kind: "judge",
    thread: String(thread.id),
    text: judged.text,
    ...(chosen ? { pick: chosen } : {}),
    ...(settle ? { settled: true as const } : {}),
    ...(moved ? { move: moved } : {}),
  });
  if (!settle) return { file };
  Events.publish({ topic: "task.decided", data: { slug: file.slug, thread: String(thread.id), text, who: lead.who } });
  return { file, decided: { file, question, ask, text } };
};

const decide = ({ given, caller, answer, thread: n }: DecideInput): Decided => {
  if (!answer.trim()) throw new Refusal("decide needs an option's number or your own words", 2);
  const opened = TaskFiles.open(given);
  const doc = Threads.read(opened.path);
  const thread = pending(doc.threads, n);
  const question = String(thread.body ?? "");
  const { text, option } = answerOf(thread.ask, question, answer);
  const at = now();
  const marco: Caller = { who: "YOU", ...(caller.from ? { from: caller.from } : {}) };
  const ask: TaskAsk = { ...thread.ask, decision: { ...saidBy(marco), text, ...(option ? { option } : {}), at } };
  const threads = replace(doc.threads, { ...thread, ask, status: "resolved", resolvedBy: "user", updated: at });
  Threads.write(opened.path, { ...doc, updated: at, threads });
  const { file, move: moved } = unblocked(opened, threads, thread);
  TaskHistory.append(file.slug, {
    ...saidBy(marco),
    kind: "decide",
    thread: String(thread.id),
    ask: thread.ask.kind,
    text,
    ...(option ? { option } : {}),
    ...(moved ? { move: moved } : {}),
  });
  Events.publish({ topic: "task.decided", data: { slug: file.slug, thread: String(thread.id), text, who: marco.who } });
  return { file, question, ask, text };
};

const tell = async ({ file, question, ask, text }: Decided): Promise<boolean> => {
  const key = ask.from ? TaskCaller.keyByTitle(ask.from) : undefined;
  if (!key) return false;
  const what = ask.kind === "hire" ? "the hire" : "your escalation";
  const by = ask.decision?.who === "PL" ? "The Project Lead settled it" : "My decision";
  const sent = await deliver({ key, text: `On ${what} in ${file.slug}, "${question}". ${by}: ${text}` });
  return sent.delivered;
};

export interface Heard {
  caller: Caller;
  kind: "turn" | "message";
  text: string;
  slug?: string;
}

const hearersOf = ({ caller, kind, slug }: Heard): TaskFile[] => {
  if (slug && kind === "message") return TaskFiles.all().filter((one) => one.slug === slug);
  const title = caller.from ? Titles.parse(caller.from) : undefined;
  if (title?.role !== "TL") return [];
  return TaskFiles.all().filter((one) => Titles.belongsTo(title, one.slug));
};

const heard = (given: Heard): TaskFile[] => {
  const { caller, kind, text } = given;
  if (!caller.from || !text.trim()) return [];
  const tasks = hearersOf(given);
  for (const file of tasks) {
    const at = now();
    const said = text.trim();
    record(
      file,
      kind === "turn"
        ? { at, who: "TL", from: caller.from, kind: "turn", text: said }
        : { at, who: "YOU", kind: "message", text: said, to: caller.from },
    );
  }
  return tasks;
};

const edited = ({ file, before, after }: { file: TaskFile; before: string; after: string }): void => {
  const parts = Parts.changed(before, after);
  if (parts.length) record(file, { at: now(), who: "YOU", kind: "content", parts });
};

const read = ({ given, caller }: { given: string; caller: Caller }): Read => {
  const file = TaskFiles.open(given);
  const entries = TaskHistory.read(file.slug);
  if (caller.who === "PL") TaskHistory.append(file.slug, { ...saidBy(caller), kind: "read" });
  return { file, entries, asks: asksOf(Threads.read(file.path).threads) };
};

export const TaskLane = {
  asksOf,
  assign,
  create,
  decide,
  edited,
  escalate,
  heard,
  judge,
  read,
  leadsOf,
  remove,
  rename,
  state,
  tell,
};
