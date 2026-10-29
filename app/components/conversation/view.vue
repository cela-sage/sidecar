<script lang="ts" setup>
import { FileText, Pencil, SquareTerminal, Wrench } from "@lucide/vue";
import type { Component } from "vue";
import type { ConversationTurn } from "~/composables/useConversation";

type Block =
  | { kind: "you" | "said" | "note"; key: string; turn: ConversationTurn }
  | { kind: "tools"; key: string; turns: ConversationTurn[] };

const ICONS: Partial<Record<string, Component>> = {
  Bash: SquareTerminal,
  Edit: Pencil,
  MultiEdit: Pencil,
  NotebookEdit: Pencil,
  Read: FileText,
  Write: Pencil,
};

const sc = useSidecar();
const live = useConversation(() => sc.sessionKey.value);

const blocks = computed<Block[]>(() => {
  const out: Block[] = [];
  for (const [at, turn] of live.stream.value.entries()) {
    const key = `${turn.at}-${at}`;
    const last = out.at(-1);
    if (turn.kind === "acting") {
      if (last?.kind === "tools") last.turns.push(turn);
      else out.push({ kind: "tools", key, turns: [turn] });
    } else if (turn.role === "user") out.push({ kind: "you", key, turn });
    else if (turn.role === "system") out.push({ kind: "note", key, turn });
    else out.push({ kind: "said", key, turn });
  }
  return out;
});
</script>

<template>
  <section class="conversation" data-region="conversation">
    <div class="scroll">
      <div class="column">
        <UiStateMessage v-if="!blocks.length" class="empty"
          >Nothing has been said in this conversation yet.</UiStateMessage
        >
        <template v-for="block in blocks" :key="block.key">
          <p v-if="block.kind === 'you'" class="you">{{ block.turn.text }}</p>
          <p v-else-if="block.kind === 'note'" class="note mono-meta">{{ block.turn.text }}</p>
          <Prose v-else-if="block.kind === 'said'" class="said" :value="block.turn.text" />
          <ul v-else-if="block.kind === 'tools'" class="tools" aria-label="What Claude did">
            <li v-for="(one, at) in block.turns" :key="at" class="tool">
              <UiIcon class="tool-icon" :icon="ICONS[one.tool ?? ''] ?? Wrench" size="xs" />
              <span class="tool-name">{{ one.tool }}</span>
              <span v-if="one.arg" class="tool-arg">{{ one.arg }}</span>
            </li>
          </ul>
        </template>
        <p v-if="live.isBusy.value" class="busy" role="status">
          <OrgMark mark="working" />
          <span class="busy-line shimmer">{{ live.step.value || "Working" }}</span>
        </p>
      </div>
    </div>
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
  @apply mx-auto box-border flex w-full max-w-187 flex-col gap-3.5 px-6 pt-4 pb-(--float-clear);
}

.empty {
  @apply py-6;
}

.you {
  @apply m-0 max-w-130 self-end rounded-2xl bg-sunken px-3.5 py-2.25 typo-body leading-normal text-pretty whitespace-pre-wrap;
}

.note {
  @apply m-0 self-center text-subtle normal-case;
}

.said {
  @apply typo-body;
}

.tools {
  @apply m-0 flex list-none flex-col overflow-hidden rounded-xl border border-border p-0;
}

.tool {
  @apply flex h-9 min-w-0 items-center gap-2 border-t border-t-border px-3;
}

.tool:first-child {
  @apply border-t-0;
}

.tool-icon {
  @apply flex-none text-muted;
}

.tool-name {
  @apply flex-none typo-caption font-semibold;
}

.tool-arg {
  @apply min-w-0 truncate typo-mono-micro text-muted;
}

.busy {
  @apply m-0 flex min-w-0 items-center gap-2 typo-body;
}

.busy-line {
  @apply min-w-0 truncate;
}
</style>
