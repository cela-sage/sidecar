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
const saidBy = (caller: Caller): Said => ({ at: now(), who: caller.who, ...(caller.from ? { from: caller.from } : {}) });

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

const state = ({ given, caller, state: now, reason, on }: StateInput): TaskFile => {
  const file = TaskFiles.open(given);
  if (now === "waiting" && !reason) throw new Refusal("waiting needs --reason, what the task waits for", 2);
  if (!file.task.project && now !== "unassigned")
    throw new Refusal(
      `${file.slug} is on no project, so it cannot be ${now}. Give it one: sidecar task ${file.slug} assign <project>`,
      2,
    );
  const was = file.task.state;
  if (was === now && !reason) return file;
  const task = { ...file.task, state: now, ...(now === "unassigned" ? { project: undefined } : {}) };
  const next = TaskFiles.restamp(file, task);
  record(next, { ...saidBy(caller), kind: "state", move: { was, now }, ...(reason ? { reason } : {}), ...(on ? { on } : {}) });
  return next;
};

const create = (title: string): TaskFile => {
  const file = TaskFiles.create(title);
  changed(file);
  return file;
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
  const ask: TaskAsk = { kind, ...(caller.from ? { from: caller.from } : {}), options: kind === "hire" ? HIRE : options };
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
  if (!hit) throw new Refusal(n ? `no escalation or hire #${n} on this task` : "nothing on this task waits on a decision", 2);
  if (hit.status === "resolved") throw new Refusal(`#${n} is settled already`, 2);
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

const judge = ({ given, caller, verdict, pick, thread: n }: JudgeInput): TaskFile => {
  const file = TaskFiles.open(given);
  const doc = Threads.read(file.path);
  const thread = pending(doc.threads, n);
  const chosen = pickOf(thread.ask.options, pick);
  const at = now();
  const ask: TaskAsk = {
    ...thread.ask,
    verdict: { ...(caller.from ? { from: caller.from } : {}), text: verdict, ...(chosen ? { pick: chosen } : {}), at },
  };
  Threads.write(file.path, { ...doc, updated: at, threads: replace(doc.threads, { ...thread, ask, updated: at }) });
  record(file, {
    ...saidBy(caller),
    kind: "judge",
    thread: String(thread.id),
    text: verdict,
    ...(chosen ? { pick: chosen } : {}),
  });
  return file;
};

const answerOf = (ask: TaskAsk, question: string, answer: string): { text: string; option?: number } => {
  const option = /^\d+$/.test(answer.trim()) ? pickOf(ask.options, Number(answer)) : undefined;
  if (!option) return { text: answer.trim() };
  if (ask.kind === "hire") return { text: `${option === 1 ? "Approved" : "Refused"}: ${question}`, option };
  return { text: ask.options[option - 1] ?? answer, option };
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
  const stillBlocked = asksOf(threads).some((one) => one.status !== "resolved" && one.ask.kind === "escalation");
  const unblocks = thread.ask.kind === "escalation" && opened.task.state === "blocked" && !stillBlocked;
  const { file, move: moved } = unblocks ? move(opened, "running") : { file: opened };
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
  const sent = await deliver({ key, text: `On ${what} in ${file.slug}, "${question}". My decision: ${text}` });
  return sent.delivered;
};

const heard = ({ caller, kind, text }: { caller: Caller; kind: "turn" | "message"; text: string }): TaskFile[] => {
  const title = caller.from ? Titles.parse(caller.from) : undefined;
  if (!caller.from || !title || title.role !== "TL" || !text.trim()) return [];
  const tasks = TaskFiles.all().filter((one) => Titles.belongsTo(title, one.slug));
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

export const TaskLane = { asksOf, assign, create, decide, edited, escalate, heard, judge, read, state, tell };
