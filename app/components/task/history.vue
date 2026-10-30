<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import type { TaskMeta } from "~/utils/tasks";

const { meta } = defineProps<{ meta: TaskMeta }>();

const task = $task();
const sc = useSidecar();
const shown = useFaceShown();
const listEl = useTemplateRef<HTMLElement>("listEl");

const rows = computed(() => Timeline.rows(task.entries, { decisionsOnly: task.onlyDecisions }));
const readAt = computed(() => Timeline.readAt(task.entries));
const dividerAt = computed(() => (task.onlyDecisions ? undefined : Timeline.dividerAt(rows.value, readAt.value)));
const picked = computed(() => rows.value.find((row) => row.folded.includes(task.picked)));
const at = computed(() => rows.value.findIndex((row) => row === picked.value));

const clock = (stamp: string): string =>
  new Date(stamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const standsEyebrow = computed(() => {
  const stands = task.stands;
  if (!stands) return "Where it stands";
  return `Where it stands · written from ${plural(stands.count, "entry")} · ${clock(stands.at)}`;
});

const readLine = computed(() =>
  readAt.value
    ? `The Domain Lead last read it at ${clock(readAt.value)}`
    : "The Domain Lead reads it the next time the task needs it",
);

function pick(index: number): void {
  task.picked = rows.value[index]?.folded[0] ?? -1;
}

function step(by: number): void {
  pick(Math.min(Math.max(Math.max(at.value, 0) + by, 0), rows.value.length - 1));
}

watch(
  rows,
  (list) => {
    if (!picked.value && list[0]) pick(0);
  },
  { immediate: true },
);

watch(
  () => task.entries.length,
  () => void task.stand(),
  { immediate: true },
);

watch(picked, () => {
  void nextTick(() => listEl.value?.querySelector("[aria-current='true']")?.scrollIntoView({ block: "nearest" }));
});

useShortcuts(
  {
    ArrowDown: { repeat: true, run: () => step(1) },
    ArrowUp: { repeat: true, run: () => step(-1) },
    J: { repeat: true, run: () => step(1) },
    K: { repeat: true, run: () => step(-1) },
  },
  { when: () => shown.value && !sc.failure.value },
);
</script>

<template>
  <section class="history" aria-label="Task history" data-region="task-history">
    <header class="bar">
      <span class="title">{{ task.onlyDecisions ? "Your decisions" : "Every entry" }}</span>
      <span class="meta mono-meta">newest first</span>
      <span class="spacer" />
      <UiChip
        :data-tip="task.onlyDecisions ? 'Show every entry' : 'Show only what you decided'"
        :selected="task.onlyDecisions"
        size="xs"
        @click="task.onlyDecisions = !task.onlyDecisions"
      >
        your decisions
      </UiChip>
    </header>

    <div ref="listEl" class="scroll">
      <div v-if="task.onlyDecisions" class="cold">
        <span class="eyebrow mono-meta">Your decisions</span>
        <span class="said"
          >The lane shows these to every Individual Contributor that escalates, so nothing gets asked twice.</span
        >
      </div>
      <div v-else-if="task.entries.length" class="cold" :data-loading="task.isStanding && !task.stands">
        <span class="eyebrow mono-meta">{{ standsEyebrow }}</span>
        <span v-if="task.stands" class="said">{{ task.stands.text }}</span>
        <span v-else class="said quiet">{{
          task.isStanding ? "Reading the history…" : "Couldn't write where it stands right now."
        }}</span>
        <span class="read mono-meta"><span class="read-dot dot" />{{ readLine }}</span>
      </div>

      <UiStateMessage v-if="!rows.length" class="empty">
        {{
          task.onlyDecisions
            ? "You haven't decided anything on this task yet."
            : `Nothing has happened on ${meta.title || "this task"} yet. Its lane, its Individual Contributor's turns and your messages land here.`
        }}
      </UiStateMessage>

      <template v-for="(row, index) in rows" :key="row.key">
        <p v-if="row.key === dividerAt" class="divider mono-meta">new since the Domain Lead read it</p>
        <TaskHistoryRow :is-picked="row === picked" :row="row" @pick="pick(index)" />
      </template>
    </div>
  </section>
</template>

<style scoped>
.history {
  @apply flex min-h-0 min-w-0 flex-col overflow-hidden;
}

.bar {
  @apply flex flex-none items-center gap-2 px-7 pt-5 pb-2;
}

.title {
  @apply typo-body-strong font-bold;
}

.meta {
  @apply text-muted normal-case;
}

.spacer {
  @apply flex-1;
}

.scroll {
  @apply flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-5 pt-1 pb-(--float-clear);
}

.scroll > * {
  @apply shrink-0;
}

.cold {
  @apply mb-1.5 flex flex-col gap-1.5 rounded-xl bg-sunken p-3;
}

.eyebrow {
  @apply text-subtle;
}

.said {
  @apply typo-body leading-normal text-pretty;
}

.quiet {
  @apply text-muted;
}

.read {
  @apply flex items-center gap-1.5 tracking-wider text-muted normal-case;
}

.read-dot {
  @apply size-1.5 bg-primary;
}

.empty {
  @apply p-1;
}

.divider {
  @apply mx-0 mt-2 mb-1.5 flex items-center gap-2.5 text-primary normal-case;
}

.divider::before,
.divider::after {
  @apply h-px flex-1 bg-primary content-[''];
}
</style>
