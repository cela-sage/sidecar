import type { ComputedRef, ShallowRef } from "vue";
import z from "zod";
import type { MascotState } from "~/components/claude/mascot.vue";
import type { Maybe, MaybeComputed } from "~/composables/useSidecar";
import { BusyRules, type Busy } from "~~/shared/utils/busy";

const Kind = z.enum(["thinking", "narration", "answer", "acting", "note", "command", "printed", "drop", "done", "end"]);

const Call = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("read"), path: z.string(), from: z.number().optional(), to: z.number().optional() }),
  z.object({ kind: z.literal("edit"), path: z.string() }),
  z.object({ kind: z.literal("run"), command: z.string() }),
]);

const Diff = z.object({
  add: z.number(),
  del: z.number(),
  hunks: z.array(z.object({ oldStart: z.number(), newStart: z.number(), lines: z.array(z.string()) })),
  isClipped: z.literal(true).optional(),
});

// A field the client cannot read drops alone, so a newer server never costs the whole turn.
const Turn = z.object({
  at: z.number(),
  role: z.enum(["assistant", "user", "system"]),
  text: z.string(),
  kind: Kind.optional().catch(undefined),
  tool: z.string().min(1).optional().catch(undefined),
  arg: z.string().min(1).optional().catch(undefined),
  call: Call.optional().catch(undefined),
  /** The provider's tool_use id, so a result pairs back to its call. */
  ref: z.string().min(1).optional().catch(undefined),
  /** Started with run_in_background, so it is long-running by construction. */
  bg: z.literal(true).optional().catch(undefined),
  queued: z.literal(true).optional().catch(undefined),
  out: z.string().optional().catch(undefined),
  diff: Diff.optional().catch(undefined),
  failed: z.literal(true).optional().catch(undefined),
  via: z.literal("terminal").optional().catch(undefined),
  model: z.string().min(1).optional().catch(undefined),
});

export type TurnKind = z.infer<typeof Kind>;
export type ConversationTurn = z.infer<typeof Turn>;

const ECHO_MS = 60_000;
const LONG_MS = 10_000;

export interface Conversation {
  /** What the mascot acts out: the newest tool call, or thinking while nothing has come back yet. */
  mascot: ComputedRef<MascotState>;
  step: MaybeComputed<string>;
  isBusy: ComputedRef<boolean>;
  stream: ShallowRef<ConversationTurn[]>;
  results: ShallowRef<Map<string, ConversationTurn>>;
  model: Maybe<string>;
}

interface ConversationSnapshot {
  offset: number;
  turns: unknown[];
}

export function asTurn(value: unknown): ConversationTurn | undefined {
  return Turn.safeParse(value).data;
}

export function parseTurn(raw: string): ConversationTurn | undefined {
  try {
    return asTurn(JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

export function useConversation(keyOf: () => string | undefined): Conversation {
  const sc = useSidecar();
  const session = computed(() => sc.sessions.value.find((one) => one.key === keyOf()));

  // Never shown, but a replayed or re-queued turn is only recognised against what already arrived.
  let turns: ConversationTurn[] = [];
  const stream = shallowRef<ConversationTurn[]>([]);
  const show = (turn: ConversationTurn): void => {
    stream.value.push(turn);
    triggerRef(stream);
  };
  const results = shallowRef(new Map<string, ConversationTurn>());
  const model = ref<string>();
  const doing = ref<ConversationTurn>();
  const awaiting = ref(false);
  const wrote = ref(false);
  const long = ref(false);
  const mascot = computed(() =>
    doingOf({
      turn: doing.value,
      awaiting: awaiting.value,
      wrote: wrote.value,
      long: long.value,
    }),
  );
  const step = computed(() => stepOf({ turn: doing.value, awaiting: awaiting.value }));
  const busy = ref<Busy>(BusyRules.IDLE);
  const isBusy = computed(() => busy.value.doing);
  let ageing: ReturnType<typeof setTimeout> | undefined;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const open = new Map<string, number>();

  // Timed from the call's own start and cancelled by its result, so silence in the transcript proves nothing.
  function block(turn: ConversationTurn): void {
    doing.value = turn;
    clearTimeout(ageing);
    clearTimeout(quiet);
    long.value = !!turn.bg;
    const since = turn.ref ? open.get(turn.ref) : undefined;
    if (!long.value && since) {
      ageing = setTimeout(
        () => {
          long.value = true;
        },
        Math.max(0, since + LONG_MS - Date.now()),
      );
    }
    if (turn.kind !== "acting") quiet = setTimeout(settle, BusyRules.QUIET_MS);
  }

  // `long` is deliberately left standing: a call that ran two minutes was long-running.
  function finish(ref?: string): void {
    if (!ref) return;
    open.delete(ref);
    if (ref === doing.value?.ref) clearTimeout(ageing);
  }

  let offset = 0;
  let source: EventSource | undefined;
  let ticket = 0;
  let candidate: ConversationTurn | undefined;

  function disconnect(): void {
    source?.close();
    source = undefined;
  }

  function held(turn: ConversationTurn): boolean {
    if (turns.some((row) => row.at === turn.at && row.role === turn.role && row.text === turn.text)) return true;
    // A re-queued message repeats on a later slice, with replies already between the two copies.
    return (
      turn.role === "user" &&
      turns.some((row) => row.role === "user" && row.text === turn.text && Math.abs(turn.at - row.at) < ECHO_MS)
    );
  }

  // Nothing marks a text block final as it is written, so the newest one stands in until the turn ends.
  function settle(): void {
    busy.value = BusyRules.IDLE;
    doing.value = undefined;
    awaiting.value = false;
    wrote.value = false;
    long.value = false;
    open.clear();
    clearTimeout(ageing);
    clearTimeout(quiet);
    if (!candidate) return;
    turns.push({ ...candidate, kind: "answer" });
    candidate = undefined;
  }

  function append(turn: ConversationTurn): void {
    // A withdrawn or delivered queue entry: drop the pending copy rather than leaving it standing.
    if (turn.kind === "drop") {
      turns = turns.filter((row) => !row.queued || (!!turn.text && row.text !== turn.text));
      return;
    }
    // A tool result carries no words and is not a note: it only reports that the call it names closed.
    if (turn.kind === "done") {
      finish(turn.ref);
      if (turn.ref) {
        results.value.set(turn.ref, turn);
        triggerRef(results);
      }
      return;
    }
    if (turn.kind === "end") {
      settle();
      return;
    }
    // The delivered copy replaces the pending one, which is what clears the queued mark.
    if (turn.role === "user" && !turn.queued) {
      const pending = turns.findIndex((row) => row.queued && row.text === turn.text);
      if (pending >= 0) turns.splice(pending, 1);
    }
    if (held(turn)) return;
    busy.value = BusyRules.next(busy.value, turn).now;
    if (turn.role === "user") {
      // Queued means the turn it belongs to has not started, so the one in flight must not be settled.
      if (!turn.queued) {
        settle();
        wrote.value = false;
        show(turn);
      }
      awaiting.value = true;
      turns.push(turn);
      return;
    }
    // Ahead of every answer mutation below: a compaction lands mid-turn and must not disturb them.
    if (turn.role === "system") {
      if (echoesNote(turn, turns.at(-1))) return;
      turns.push(turn);
      show(turn);
      return;
    }
    awaiting.value = false;
    if (turn.model) model.value = turn.model;
    if (turn.kind === "acting") {
      if (turn.ref) open.set(turn.ref, turn.at);
      block(turn);
      if (wroteIn(turn)) wrote.value = true;
      show(turn);
      return;
    }
    // Narration detects no state of its own, so it drops the mascot back to thinking.
    if (turn.kind === "narration" || turn.kind === "thinking") {
      block(turn);
      if (turn.kind === "narration") {
        candidate = turn;
        show(turn);
      }
      return;
    }
    candidate = undefined;
    doing.value = undefined;
    turns.push(turn);
    show(turn);
  }

  function listen(key: string): void {
    disconnect();
    const stream = new EventSource(`/api/sessions/${encodeURIComponent(key)}/stream?since=${offset}`);
    source = stream;
    stream.addEventListener("turn", (event: MessageEvent<string>) => {
      const turn = parseTurn(event.data);
      if (turn) append(turn);
    });
  }

  async function follow(key?: string): Promise<void> {
    const mine = ++ticket;
    disconnect();
    turns = [];
    stream.value = [];
    results.value = new Map();
    model.value = undefined;
    candidate = undefined;
    doing.value = undefined;
    awaiting.value = false;
    wrote.value = false;
    long.value = false;
    open.clear();
    clearTimeout(ageing);
    offset = 0;
    if (!key) return;
    try {
      const snap = await $fetch<ConversationSnapshot>(`/api/sessions/${encodeURIComponent(key)}/conversation`);
      if (mine !== ticket) return;
      offset = snap.offset;
      for (const row of snap.turns) {
        const turn = asTurn(row);
        if (turn) append(turn);
      }
      // A replay can leave a call dangling on the live-stream timers; settle now so reload skips the flash.
      if (session.value?.status !== "busy") settle();
      listen(key);
    } catch {
      // An unreadable snapshot leaves the mascot at rest rather than acting out a guess.
    }
  }

  onMounted(() => {
    watch(keyOf, (key) => void follow(key), { immediate: true });
    // The registry is the only thing that knows the turn is over; a text block never says so itself.
    watch(
      () => session.value?.status,
      (now, before) => {
        if (before === "busy" && now !== "busy") settle();
      },
    );
    onScopeDispose(() => {
      ticket += 1;
      clearTimeout(ageing);
      clearTimeout(quiet);
      disconnect();
    });
  });

  return { isBusy, mascot, model, results, step, stream };
}
