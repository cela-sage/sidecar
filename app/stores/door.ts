import type { Started } from "~~/shared/types/assistant";
import type { Question } from "~~/shared/types/question";
import type { LiveSession } from "~~/shared/types/session";
import type { TaskState } from "~~/shared/types/task";
import { Titles } from "~~/shared/utils/titles";
import type { Delivery } from "~/stores/notes";

export type DoorTarget = { kind: "assistant"; key?: string } | { kind: "new" };
export type DoorMode = DoorTarget["kind"];
export type DoorStep = "working" | "answered" | "waiting" | "failed";

export type DoorContext =
  { kind: "task"; slug: string; title: string } | { kind: "conversation"; key: string; title: string };

export interface DoorReceipt {
  slug: string;
  title: string;
  was: TaskState;
  now: TaskState;
  isUndone?: boolean;
}

export interface DoorExchange {
  id: string;
  to?: string;
  text: string;
  step: DoorStep;
  isQueued?: boolean;
  answer?: string;
  questions?: Question[];
  failure?: string;
  receipts: DoorReceipt[];
}

export interface DoorSend {
  text: string;
  context?: DoorContext;
}

interface Following {
  stop: () => void;
  heard: (slug: string, now: TaskState) => void;
}

const FOLLOW_MS = 15 * 60_000;
const OPEN_MS = 2000;

const FAILED: Record<Exclude<Delivery, { delivered: true }>["reason"], string> = {
  "no-live-session": "isn't running, so it never got the message",
  "refused-by-inbox": "refused the message, try again in a moment",
};

export const $door = defineStore(() => {
  const sc = useSidecar();
  const task = $task();
  const desk = $desk();
  const isOpen = ref(false);
  const draft = ref("");
  const target = ref<DoorTarget>({ kind: "assistant" });
  const exchanges = ref<DoorExchange[]>([]);
  const following = new Map<string, Following>();

  const isAssistant = (session: LiveSession): boolean =>
    (!session.archived || session.live) && !!session.name && Titles.parse(session.name)?.role === "EA";

  const assistants = computed(() =>
    sc.sessions.value
      .filter(isAssistant)
      .sort((a, b) => Number(b.live) - Number(a.live) || (b.lastActive ?? 0) - (a.lastActive ?? 0)),
  );

  const key = computed(() => {
    if (target.value.kind !== "assistant") return undefined;
    return target.value.key ?? assistants.value.find((one) => one.live)?.key;
  });

  const assistant = computed(() => assistants.value.find((one) => one.key === key.value));

  const mode = computed<DoorMode>(() => {
    if (target.value.kind !== "assistant") return target.value.kind;
    return key.value ? "assistant" : "new";
  });

  const thread = computed(() => exchanges.value.filter((one) => one.to === key.value));

  const find = (id: string): DoorExchange | undefined => exchanges.value.find((one) => one.id === id);

  const update = (id: string, patch: Partial<DoorExchange>): void => {
    const live = find(id);
    if (live) Object.assign(live, patch);
  };

  // Sent mid-turn, a message lands queued, and only the queue handing it over says the model has it.
  const follow = (id: string, to: string, isTaken = false): Promise<void> => {
    const source = new EventSource(`/api/sessions/${encodeURIComponent(to)}/stream`);
    const states = new Map(Tasks.of(sc.catalogue.value).map((one) => [one.slug, one.task.state]));
    let isOurs = isTaken;
    let isWaiting = false;
    let said: string | undefined;
    let asked: string | undefined;
    const stop = (): void => {
      source.close();
      clearTimeout(timer);
      following.delete(id);
    };
    const timer = setTimeout(stop, FOLLOW_MS);
    const heard = (slug: string, now: TaskState): void => {
      const was = states.get(slug);
      states.set(slug, now);
      const live = find(id);
      if (!was || was === now || live?.step !== "working") return;
      const meta = Tasks.of(sc.catalogue.value).find((one) => one.slug === slug);
      live.receipts.push({ slug, title: meta?.title || deslug(slug), was, now });
    };
    following.set(id, { stop, heard });
    source.addEventListener("turn", (event: MessageEvent<string>) => {
      const turn = parseTurn(event.data);
      if (!turn) return;
      if (!isOurs && turn.role === "user" && turn.queued) {
        isWaiting = true;
        return update(id, { isQueued: true });
      }
      if (!isOurs && ((turn.role === "user" && !turn.queued) || (isWaiting && turn.kind === "drop"))) {
        isOurs = true;
        return update(id, { isQueued: false });
      }
      if (!isOurs) return;
      if (turn.kind === "end") {
        update(id, { step: "answered", answer: said });
        return stop();
      }
      if (turn.kind === "done" && turn.ref && turn.ref === asked) {
        asked = undefined;
        return update(id, { step: "working", questions: undefined });
      }
      if (turn.role !== "assistant") return;
      if (turn.kind === "narration" || turn.kind === "answer") said = turn.text;
      if (turn.kind === "acting" && turn.tool === "AskUserQuestion") {
        asked = turn.ref;
        update(id, { step: "waiting", answer: said, questions: turn.ask });
      }
    });
    return new Promise((ready) => {
      source.addEventListener("open", () => ready(), { once: true });
      setTimeout(ready, OPEN_MS);
    });
  };

  const hearChange = (slug: string, now: TaskState): void => {
    for (const one of following.values()) one.heard(slug, now);
  };

  const undo = async (receipt: DoorReceipt): Promise<void> => {
    await desk.move(receipt.slug).catch(() => undefined);
    receipt.isUndone = true;
    await task.readTasks();
  };

  const composed = ({ text, context }: DoorSend): string =>
    context?.kind === "conversation" ? `About the conversation ${context.title} (${context.key}):\n\n${text}` : text;

  const slugOf = (context?: DoorContext): string | undefined => (context?.kind === "task" ? context.slug : undefined);

  // The pushed copy is the reactive one, so later writes go through it.
  const exchange = (text: string, to?: string): DoorExchange => {
    const made: DoorExchange = {
      id: crypto.randomUUID(),
      text,
      step: "working",
      receipts: [],
      ...(to ? { to } : {}),
    };
    exchanges.value.push(made);
    return find(made.id) ?? made;
  };

  const tell = ({ key: to, text, slug }: { key: string; text: string; slug?: string }): Promise<Delivery> =>
    $fetch<Delivery>(`/api/sessions/${encodeURIComponent(to)}/message`, {
      body: { text, ...(slug ? { slug } : {}) },
      method: "POST",
    }).catch((): Delivery => ({ delivered: false, reason: "refused-by-inbox" }));

  const ask = async (sent: DoorSend, to: string): Promise<void> => {
    const made = exchange(sent.text, to);
    await follow(made.id, to);
    const reply = await tell({ key: to, text: composed(sent), slug: slugOf(sent.context) });
    if (reply.delivered) return;
    following.get(made.id)?.stop();
    const name = assistant.value?.name ?? "The assistant";
    update(made.id, { step: "failed", failure: `${name} ${FAILED[reply.reason]}.` });
  };

  const start = async (sent: DoorSend): Promise<void> => {
    const made = exchange(sent.text);
    const slug = slugOf(sent.context);
    const started = await $fetch<Started>("/api/assistant", {
      body: { text: composed(sent), ...(slug ? { slug } : {}) },
      method: "POST",
    }).catch((): Started => ({ started: false, reason: "The sidecar could not reach its server." }));
    if (!started.started)
      return update(made.id, { step: "failed", failure: `No assistant started. ${started.reason}` });
    if (!started.key) {
      return update(made.id, {
        step: "answered",
        answer: "Started. It lists in the tree once Claude Code registers it.",
      });
    }
    made.to = started.key;
    target.value = { kind: "assistant", key: started.key };
    void follow(made.id, started.key, true);
  };

  const send = async (sent: DoorSend): Promise<void> => {
    const text = sent.text.trim();
    if (!text) return;
    draft.value = "";
    if (mode.value === "assistant" && key.value) return ask({ ...sent, text }, key.value);
    return start({ ...sent, text });
  };

  const clear = (): void => {
    const gone = new Set(thread.value.map((one) => one.id));
    for (const id of gone) following.get(id)?.stop();
    exchanges.value = exchanges.value.filter((one) => !gone.has(one.id));
  };

  return {
    assistant,
    assistants,
    clear,
    draft,
    hearChange,
    isOpen,
    key,
    mode,
    send,
    target,
    thread,
    undo,
  };
});
