import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Refusal } from "../lib/sidecar/refusal.ts";
import { TaskState } from "../shared/types/task.ts";
import type { HistoryEntry } from "../shared/types/history.ts";
import { HistoryLines } from "../shared/utils/history.ts";
import { TaskCaller } from "../server/utils/tasks/caller.ts";
import { TaskLane, type AskThread, type Decided } from "../server/utils/tasks/lane.ts";
import { TaskNotice } from "../server/utils/tasks/notice.ts";

export const TASK_USAGE = `usage: sidecar task new "<title>" | sidecar task <slug> [verb]
  new "<title>"              write an unassigned task with the four parts as headings, and print its slug
  (no verb)                  where it stands: its state, what waits on a decision, your decisions, the history
  state <state> [--reason "why"] [--on "who"]
                             set its state, one of ${TaskState.join(", ")}; waiting needs --reason
  assign <project>           put it on a project
  rename "<title>"           retitle it, keeping its slug, so every link to it holds
  escalate "<question>" [--options "a" --options "b" | --options a,b] [--quote "the text it is about"]
                             ask Marco: a red thread on the task, blocked, and a notification on his Mac
  hire "<who, why, tier>"    propose a specialist, which Marco approves or refuses like an escalation
  judge "<verdict>" [--pick <n>] [--thread <n>]
                             the Project Lead's read of the open escalation, and its pick
  decide <n|"words"> [--thread <n>]
                             settle it, and the conversation that asked hears the decision
  done                       mark it done
Every verb lands in the task's history, which Task Lead turns join on their own.`;

interface Run {
  slug: string;
  words: string[];
  values: Values;
  address: string;
}

type Values = Partial<Record<"reason" | "on" | "quote" | "pick" | "thread" | "heard", string>> & {
  options?: string[];
  json?: boolean;
};

const OPTIONS = {
  reason: { type: "string" },
  on: { type: "string" },
  quote: { type: "string" },
  options: { type: "string", multiple: true },
  pick: { type: "string" },
  thread: { type: "string" },
  heard: { type: "string" },
  json: { type: "boolean" },
} as const;

const caller = TaskCaller.of;

const clock = (at: string): string => {
  const when = new Date(at);
  const time = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return when.toDateString() === new Date().toDateString()
    ? time
    : `${when.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
};

const lineOf = (entry: HistoryEntry): string => {
  const { lead, text } = HistoryLines.of(entry);
  const said = `${lead}${text}`.split("\n")[0] ?? "";
  return `  ${clock(entry.at).padEnd(13)} ${entry.who.padEnd(4)} ${said.length > 110 ? `${said.slice(0, 109)}…` : said}`;
};

const optionsOf = (given: string[] = []): string[] =>
  (given.length === 1 ? (given[0] ?? "").split(",") : given).map((one) => one.trim()).filter(Boolean);

const askLines = (thread: AskThread): string[] => {
  const { ask } = thread;
  const pick = ask.verdict?.pick;
  return [
    `  #${String(thread.n)} ${ask.kind}${ask.from ? ` from ${ask.from}` : ""}: ${String(thread.body)}`,
    ...(ask.verdict ? [`     the Project Lead: ${ask.verdict.text}`] : []),
    ...ask.options.map((one, i) => `     ${i + 1}. ${one}${pick === i + 1 ? "  (the Project Lead's pick)" : ""}`),
  ];
};

const told = async (decided: Decided): Promise<string> =>
  (await TaskLane.tell(decided))
    ? `told ${decided.ask.from}`
    : `${decided.ask.from ?? "the conversation that asked"} isn't running, so it reads this in the history`;

const show = ({ slug, values }: Run): number => {
  const { file, entries, asks } = TaskLane.read({ given: slug, caller: caller() });
  if (values.json) {
    console.log(JSON.stringify({ ...file, entries, asks }, null, 2));
    return 0;
  }
  const open = asks.filter((one) => one.status !== "resolved");
  const decisions = entries.filter((one) => HistoryLines.of(one).isDecision);
  const shown = entries.filter((one) => one.kind !== "read");
  const where = `${file.task.project ?? "inbox"} · ${file.task.state}${file.task.lead ? ` · lead ${file.task.lead}` : ""}`;
  console.log(
    [
      `${file.title}  ${where}`,
      ...(open.length
        ? ["", "Waits on a decision", ...open.flatMap(askLines), `  sidecar task ${file.slug} decide <n|"words">`]
        : []),
      ...(decisions.length ? ["", "Marco's decisions", ...decisions.map(lineOf)] : []),
      "",
      shown.length ? `History, newest first, ${shown.length} entries` : "No history yet.",
      ...shown.slice(-20).reverse().map(lineOf),
    ].join("\n"),
  );
  return 0;
};

const stateOf = (word = ""): TaskState => {
  const hit = TaskState.find((one) => one === word);
  if (!hit) throw new Refusal(`'${word}' is not a task state. One of: ${TaskState.join(", ")}`, 2);
  return hit;
};

const escalated = async (run: Run, kind: "escalation" | "hire"): Promise<number> => {
  const text = run.words.join(" ").trim();
  if (!text)
    throw new Refusal(
      kind === "hire" ? "hire needs who, why and the tier in quotes" : "escalate needs the question in quotes",
      2,
    );
  const { file, thread, decisions } = TaskLane.escalate({
    given: run.slug,
    caller: caller(),
    kind,
    text,
    options: optionsOf(run.values.options),
    ...(run.values.quote ? { quote: run.values.quote } : {}),
  });
  const notice = { title: file.title, subtitle: kind === "hire" ? "A hire needs you" : "Needs you", text };
  const raised = await TaskNotice.raise({ address: run.address, notice });
  const where =
    raised === "page"
      ? "the open sidecar notified Marco"
      : `notified Marco on the Mac, whose click opens Script Editor rather than /tasks/${file.slug}`;
  console.log(
    [
      `#${String(thread.n)} is on ${file.slug}, ${file.task.state}, and ${where}.`,
      ...(decisions.length ? ["Marco already decided, on this task:", ...decisions.map(lineOf)] : []),
      `It settles with sidecar task ${file.slug} decide <n|"words">, and you hear the decision.`,
    ].join("\n"),
  );
  return 0;
};

const VERBS: Record<string, (run: Run) => Promise<number>> = {
  state: async ({ slug, words, values }) => {
    const file = TaskLane.state({
      given: slug,
      caller: caller(),
      state: stateOf(words[0]),
      ...(values.reason ? { reason: values.reason } : {}),
      ...(values.on ? { on: values.on } : {}),
    });
    console.log(`${file.slug} is ${file.task.state}`);
    return 0;
  },
  assign: async ({ slug, words }) => {
    const file = TaskLane.assign({ given: slug, caller: caller(), project: words[0] ?? "" });
    console.log(`${file.slug} is on ${file.task.project}, ${file.task.state}`);
    return 0;
  },
  rename: async ({ slug, words }) => {
    const file = TaskLane.rename({ given: slug, caller: caller(), title: words.join(" ") });
    console.log(`${file.slug} is titled ${file.title}`);
    return 0;
  },
  escalate: (run) => escalated(run, "escalation"),
  hire: (run) => escalated(run, "hire"),
  judge: async ({ slug, words, values }) => {
    const pick = values.pick ? Number(values.pick) : undefined;
    const file = TaskLane.judge({
      given: slug,
      caller: caller(),
      verdict: words.join(" "),
      ...(pick ? { pick } : {}),
      ...(values.thread ? { thread: values.thread } : {}),
    });
    console.log(`your verdict is on ${file.slug}, which still waits on Marco`);
    return 0;
  },
  decide: async ({ slug, words, values }) => {
    const decided = TaskLane.decide({
      given: slug,
      caller: caller(),
      answer: words.join(" "),
      ...(values.thread ? { thread: values.thread } : {}),
    });
    console.log(
      `settled: ${decided.text}\n${decided.file.slug} is ${decided.file.task.state}, and ${await told(decided)}`,
    );
    return 0;
  },
  done: async ({ slug }) => {
    const file = TaskLane.state({ given: slug, caller: caller(), state: "done" });
    console.log(`${file.slug} is done`);
    return 0;
  },
};

// The mod pipes a Task Lead's turn, or what Marco typed to it, on stdin, so no text ever passes through argv.
const heard = (kind: string): number => {
  if (kind !== "turn" && kind !== "message") throw new Refusal("--heard is turn or message", 2);
  const tasks = TaskLane.heard({ caller: caller(), kind, text: readFileSync(0, "utf8") });
  if (tasks.length) console.log(`in the history of ${tasks.map((one) => one.slug).join(", ")}`);
  return 0;
};

const created = (title: string): number => {
  if (!title.trim()) throw new Refusal('new needs the task\'s title in quotes: sidecar task new "<title>"', 2);
  console.log(TaskLane.create(title.trim()).slug);
  return 0;
};

const run = async (argv: string[], address: string): Promise<number> => {
  const { positionals, values } = parseArgs({ args: argv, allowPositionals: true, options: OPTIONS });
  if (values.heard) return heard(values.heard);
  const [slug, verb, ...words] = positionals;
  if (!slug) {
    console.error(TASK_USAGE);
    return 2;
  }
  if (slug === "new") return created(positionals.slice(1).join(" "));
  const one = { slug, words, values, address };
  if (!verb) return show(one);
  const act = VERBS[verb];
  if (!act) throw new Refusal(`no task verb '${verb}'\n\n${TASK_USAGE}`, 2);
  return act(one);
};

export const TaskCommand = {
  run: (argv: string[], address: string): Promise<number> =>
    run(argv, address).catch((error: unknown) => {
      if (!(error instanceof Refusal)) throw error;
      console.error(error.message);
      return error.code;
    }),
};
