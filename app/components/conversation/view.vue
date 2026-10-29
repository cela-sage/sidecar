<script lang="ts" setup>
import { Terminal } from "@lucide/vue";
import type { ConversationTurn } from "~/composables/useConversation";
import type { PromptSent } from "~/stores/prompt";

type Block =
  | { kind: "you" | "said" | "note"; key: string; turn: ConversationTurn }
  | { kind: "tools"; key: string; turns: ConversationTurn[] };

const sc = useSidecar();
const prompt = $prompt();
const tree = useOrgTree();
const live = useConversation(() => sc.sessionKey.value);
const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

const key = computed(() => sc.sessionKey.value ?? "");
const session = computed(() => sc.sessions.value.find((one) => one.key === key.value));
const name = computed(() => Org.placeOf(tree.value, key.value)?.row.name ?? (session.value ? nameOf(session.value) : ""));
const model = computed(() => prompt.chosen[key.value] ?? live.model.value);

const blocks = computed<Block[]>(() => {
  const out: Block[] = [];
  for (const [at, turn] of live.stream.value.entries()) {
    const id = `${turn.at}-${at}`;
    const last = out.at(-1);
    if (turn.kind === "acting") {
      if (last?.kind === "tools") last.turns.push(turn);
      else out.push({ kind: "tools", key: id, turns: [turn] });
    } else if (turn.role === "user") out.push({ kind: "you", key: id, turn });
    else if (turn.role === "system") out.push({ kind: "note", key: id, turn });
    else out.push({ kind: "said", key: id, turn });
  }
  return out;
});

// A message queued behind a running turn reaches the stream only once delivered, so the sent copy stands in until then.
const landedOf = (one: PromptSent): boolean =>
  live.stream.value.some((turn) => turn.role === "user" && turn.at >= one.at - 5000 && turn.text.trim() === one.text);
const pending = computed(() => prompt.sent.filter((one) => one.key === key.value && !landedOf(one)));

watch(
  () => live.stream.value.length,
  () => {
    for (const one of prompt.sent) if (one.key === key.value && landedOf(one)) prompt.landed(one);
  },
);

watch(live.model, (now) => {
  if (now && prompt.chosen[key.value] === now) prompt.chosen = { ...prompt.chosen, [key.value]: undefined };
});
</script>

<template>
  <section class="conversation" data-region="conversation">
    <div class="scroll">
      <div class="column">
        <UiStateMessage v-if="!blocks.length && !pending.length" class="empty"
          >Nothing has been said in this conversation yet.</UiStateMessage
        >
        <template v-for="block in blocks" :key="block.key">
          <div v-if="block.kind === 'you'" class="you">
            <p class="bubble">{{ block.turn.text }}</p>
            <span v-if="block.turn.via === 'terminal'" class="typed mono-meta">
              <UiIcon :icon="Terminal" size="xs" />typed in your terminal · {{ clock.format(block.turn.at) }}
            </span>
          </div>
          <p v-else-if="block.kind === 'note'" class="note mono-meta">{{ block.turn.text }}</p>
          <Prose v-else-if="block.kind === 'said'" class="said" :conversation="key" :value="block.turn.text" />
          <ConversationTools
            v-else-if="block.kind === 'tools'"
            :is-busy="live.isBusy.value"
            :results="live.results.value"
            :turns="block.turns"
          />
        </template>
        <div v-for="one in pending" :key="one.at" class="you" data-pending="true">
          <p class="bubble">{{ one.text }}</p>
          <span class="typed mono-meta">{{ live.isBusy.value ? "queued behind the turn in flight" : "sending" }}</span>
        </div>
        <p v-if="live.isBusy.value" class="busy" role="status">
          <ClaudeMascot :size="20" :state="live.mascot.value" />
          <span class="busy-line shimmer">{{ live.step.value || "Working" }}</span>
        </p>
      </div>
    </div>
    <ConversationPrompt v-if="key" :is-busy="live.isBusy.value" :model="model" :name="name" />
  </section>
</template>

<style scoped>
.conversation {
  @apply flex h-full min-h-0 flex-col;
}

/* Reversed, so the browser keeps the newest turn in view as the stream grows and leaves a reader scrolled up alone. */
.scroll {
  @apply flex min-h-0 flex-1 flex-col-reverse overflow-y-auto;
}

.column {
  @apply mx-auto box-border flex w-full max-w-187 flex-col gap-3.5 px-6 pt-4 pb-3.5;
}

.empty {
  @apply py-6;
}

.you {
  @apply flex flex-col items-end gap-1.25;
}

.bubble {
  @apply m-0 max-w-130 rounded-2xl bg-sunken px-3.5 py-2.25 typo-body leading-normal text-pretty whitespace-pre-wrap;
}

.you[data-pending="true"] .bubble {
  @apply opacity-60;
}

.typed {
  @apply inline-flex items-center gap-1.25 pr-1 text-muted normal-case;
}

.note {
  @apply m-0 self-center text-subtle normal-case;
}

.said {
  @apply typo-body;
}

.busy {
  @apply m-0 flex min-w-0 items-center gap-2.5 typo-body;
}

.busy-line {
  @apply min-w-0 truncate font-medium;
}
</style>
