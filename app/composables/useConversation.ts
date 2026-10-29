import type { ComputedRef, ShallowRef } from "vue";
import type { MascotState } from "~/components/claude/mascot.vue";
import type { Maybe, MaybeComputed } from "~/composables/useSidecar";
import type { ConversationTurn } from "~/utils/conversation-turn";
import { BusyRules, type Busy } from "~~/shared/utils/busy";

const ECHO_MS = 60_000;
const LONG_MS = 10_000;
const RECEIPT_MS = 5_000;

const isReceiptOf = (receipt: ConversationTurn, row: ConversationTurn): boolean =>
  receipt.text === row.text && Math.abs(receipt.at - row.at) < RECEIPT_MS;

export interface Conversation {
  /** What the mascot acts out: the newest tool call, or thinking while nothing has come back yet. */
  mascot: ComputedRef<MascotState>;
  step: MaybeComputed<string>;
  isBusy: ComputedRef<boolean>;
  stream: ShallowRef<ConversationTurn[]>;
  model: Maybe<string>;
  mode: Maybe<string>;
}

interface ConversationSnapshot {
  offset: number;
  turns: unknown[];
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
  const model = ref<string>();
  const mode = ref<string>();
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
  const received = new Set<ConversationTurn>();
  const commands = commandReceipts<ConversationTurn>();

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
    if (turn.kind !== "acting") quiet = setTimeout(rest, BusyRules.QUIET_MS);
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

  function rest(): void {
    busy.value = BusyRules.IDLE;
    doing.value = undefined;
    awaiting.value = false;
    wrote.value = false;
    long.value = false;
    open.clear();
    clearTimeout(ageing);
    clearTimeout(quiet);
  }

  // Nothing marks a text block final as it is written, so the newest one is held back and only drawn once the turn is over.
  function settle(): void {
    rest();
    if (!candidate) return;
    const answer: ConversationTurn = { ...candidate, kind: "answer" };
    candidate = undefined;
    if (held(answer)) return;
    turns.push(answer);
    show(answer);
  }

  // The transcript writes a delivery's row only when the running turn next reads it, so the mod's receipt shows it sooner.
  function receive({ text, at }: { text: string; at: number }): void {
    const turn: ConversationTurn = { role: "user", text, at };
    if (turns.some((row) => row.role === "user" && !row.queued && isReceiptOf(turn, row))) return;
    received.add(turn);
    show(turn);
  }

  function takeReceipt(row: ConversationTurn): boolean {
    const receipt = [...received].find((turn) => isReceiptOf(turn, row));
    return !!receipt && received.delete(receipt);
  }

  function append(turn: ConversationTurn): void {
    if (turn.mode) mode.value = turn.mode;
    // A withdrawn or delivered queue entry: drop the pending copy rather than leaving it standing.
    if (turn.kind === "drop") {
      turns = turns.filter((row) => !row.queued || (!!turn.text && row.text !== turn.text));
      return;
    }
    // A tool result carries no words and is not a note: it only reports that the call it names closed.
    if (turn.kind === "done") {
      finish(turn.ref);
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
      // Queued means the turn it belongs to has not started and joined that it already has, so neither settles the one in flight.
      if (!turn.queued && !turn.joined) {
        settle();
        wrote.value = false;
      }
      if (!turn.queued && !takeReceipt(turn)) show(turn);
      awaiting.value = true;
      turns.push(turn);
      return;
    }
    // Ahead of every answer mutation below: a compaction lands mid-turn and must not disturb them.
    if (turn.role === "system") {
      if (echoesNote(turn, turns.at(-1))) return;
      const joined = commands.join(turn, turns);
      turns.push(turn);
      if (!joined && turn.kind !== "note") show(turn);
      return;
    }
    awaiting.value = false;
    if (turn.model) model.value = turn.model;
    if (turn.kind === "acting") {
      if (turn.ref) open.set(turn.ref, turn.at);
      block(turn);
      if (wroteIn(turn)) wrote.value = true;
      return;
    }
    // Narration detects no state of its own, so it drops the mascot back to thinking.
    if (turn.kind === "narration" || turn.kind === "thinking") {
      block(turn);
      if (turn.kind === "narration") candidate = turn;
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
    received.clear();
    commands.clear();
    model.value = undefined;
    mode.value = undefined;
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

  useEvents().on("message.landed", ({ data, at }) => {
    if (data.key === keyOf()) receive({ text: data.text, at: Date.parse(at) });
  });

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

  return { isBusy, mascot, mode, model, step, stream };
}
