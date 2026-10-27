<script lang="ts" setup>
import { ChevronDown, ChevronUp, Eye } from "@lucide/vue";
import { Feed, type HistoryEntry } from "~~/shared/types/history";
import { Titles } from "~~/shared/utils/titles";
import type { TaskMeta } from "~/utils/tasks";

const { meta } = defineProps<{ meta: TaskMeta }>();

const task = $task();
const { decide, isSending } = useTaskDecide();

const FEEDS: Record<Feed, string> = {
  turn: "Task Lead turns, off the conversation bus",
  change: "status and content changes",
  ask: "escalations and your decisions",
  message: "your messages to a Task Lead",
};

const rows = computed(() => Timeline.rows(task.entries, { decisionsOnly: task.onlyDecisions }));
const at = computed(() => rows.value.findIndex((row) => row.folded.includes(task.picked)));
const row = computed(() => rows.value[at.value]);
const thread = computed(() => task.asks.find((one) => !!row.value?.thread && one.id === row.value.thread));
const turns = computed(() =>
  row.value?.kind === "turn"
    ? row.value.folded.flatMap((index) => {
        const entry = task.entries[index];
        return entry?.kind === "turn" ? [entry] : [];
      })
    : [],
);
const feeds = computed(() => {
  const counts = Timeline.feeds(task.entries);
  return Feed.map((feed) => ({ feed, n: counts[feed], label: FEEDS[feed] }));
});
const readAt = computed(() => Timeline.readAt(task.entries));

const clock = (stamp: string): string =>
  new Date(stamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const EYEBROW: Record<HistoryEntry["kind"], string> = {
  turn: "Task Lead turn",
  message: "Your message to the Task Lead",
  state: "Status change",
  assign: "Status change",
  content: "Content change",
  ask: "Escalation",
  judge: "The Project Lead's verdict",
  decide: "Your decision",
  read: "Read",
};

const eyebrow = computed(() => {
  const one = row.value;
  if (!one) return "";
  if (one.kind === "turn" && one.folded.length > 1) return `${one.folded.length} Task Lead turns · newest ${clock(one.at)}`;
  if (one.kind === "turn") return `Task Lead turn · ${clock(one.at)} · off the conversation bus`;
  if (one.kind === "decide" && one.who !== "YOU") return `The Project Lead's decision · ${clock(one.at)}`;
  const settles = one.kind === "decide" ? ` · settles ${thread.value?.ask?.kind === "hire" ? "a hire" : "an escalation"}` : "";
  return `${EYEBROW[one.kind]} · ${clock(one.at)}${settles}`;
});

const isNew = computed(() => !!row.value && !!readAt.value && row.value.at > readAt.value);
const seen = computed(() => {
  if (!row.value) return "";
  if (!readAt.value || isNew.value) return "Just landed. The Project Lead reads it the next time the task needs it.";
  return `The Project Lead read this at ${clock(readAt.value)}, and the lane shows it to every Task Lead that escalates.`;
});
const chips = computed(() => [...(row.value?.chips ?? []), ...(isNew.value ? ["new since the Project Lead read it"] : [])]);

const speaker = (title?: string): { token?: string; rest: string } => {
  const parsed = title ? Titles.parse(title) : undefined;
  return { token: parsed?.token, rest: parsed?.rest ?? title ?? "The Task Lead" };
};

function step(by: number): void {
  const next = rows.value[Math.min(Math.max(at.value + by, 0), rows.value.length - 1)];
  task.picked = next?.folded[0] ?? task.picked;
}
</script>

<template>
  <UiSurface class="entry" aria-label="Entry" data-region="task-entry" pad="none" variant="raised">
    <template v-if="row">
      <header class="bar">
        <div class="line">
          <span class="eyebrow mono-meta">{{ eyebrow }}</span>
          <span class="spacer" />
          <ChromeAction :disabled="at <= 0" :icon="ChevronUp" shape="pill" tip="Newer entry · {K}" @click="step(-1)" />
          <ChromeAction
            :disabled="at >= rows.length - 1"
            :icon="ChevronDown"
            shape="pill"
            tip="Older entry · {J}"
            @click="step(1)"
          />
        </div>
        <p class="title">{{ row.lead }}{{ row.text.split("\n")[0] }}</p>
        <div v-if="chips.length" class="chips">
          <span v-for="chip in chips" :key="chip" class="chip mono-meta">{{ chip }}</span>
        </div>
      </header>

      <div class="body">
        <template v-if="thread">
          <div class="column">
            <TaskEscalation :is-sending="isSending" :thread="thread" @decide="decide(thread, $event)" />
          </div>
          <p class="seen"><UiIcon :icon="Eye" size="xs" />{{ seen }}</p>
        </template>

        <template v-else-if="turns.length">
          <article v-for="one in turns" :key="one.at" class="turn">
            <div class="by">
              <span class="badge">TL</span>
              <span class="name"
                ><span v-if="speaker(one.from).token" class="token">[{{ speaker(one.from).token }}]</span>
                {{ speaker(one.from).rest }}</span
              >
              <span class="when mono-meta">{{ clock(one.at) }}</span>
            </div>
            <p class="said">{{ one.text }}</p>
          </article>
          <p class="caption">
            This is the turn as the Task Lead wrote it, off the conversation bus, so the Project Lead reads its words
            rather than a log.
          </p>
        </template>

        <article v-else class="turn">
          <p class="said">
            <strong v-if="row.lead">{{ row.lead }}</strong>{{ row.text }}
          </p>
        </article>

        <div class="made">
          <span class="eyebrow mono-meta">What the history is made of</span>
          <div class="feeds">
            <div v-for="one in feeds" :key="one.feed" class="feed">
              <span class="n">{{ one.n }}</span>
              <span class="label">{{ one.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <UiStateMessage v-else align="center">
      {{ task.entries.length ? "Pick an entry to read it." : `Nothing has happened on ${meta.title || "this task"} yet.` }}
    </UiStateMessage>
  </UiSurface>
</template>

<style scoped>
.entry {
  @apply flex min-h-0 flex-col overflow-hidden;
}

.bar {
  @apply flex flex-none flex-col gap-2 border-b border-b-border py-3 pr-3.5 pl-4;
}

.line {
  @apply flex min-h-6.5 items-center gap-2;
}

.eyebrow {
  @apply text-subtle;
}

.spacer {
  @apply flex-1;
}

.title {
  @apply m-0 max-w-220 typo-heading-md leading-snug font-bold text-pretty;
}

.chips {
  @apply flex flex-wrap gap-1.5;
}

.chip {
  @apply rounded-full bg-sunken px-2 py-0.5 tracking-normal text-muted normal-case;
}

.body {
  @apply flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-5 pb-(--float-clear);
}

.column {
  @apply max-w-160;
}

.seen,
.caption {
  @apply m-0 flex max-w-160 items-center gap-2 typo-caption leading-normal text-pretty text-muted;
}

.turn {
  @apply flex max-w-160 flex-col gap-2.5 rounded-2xl border border-border bg-raised px-4 py-3.5;
}

.by {
  @apply flex items-center gap-2;
}

.badge {
  @apply inline-flex size-5.5 flex-none items-center justify-center rounded-full bg-primary-soft typo-mono-nano font-semibold text-primary-deep;
}

.name {
  @apply min-w-0 truncate typo-body font-bold;
}

.token {
  @apply font-semibold text-muted;
}

.when {
  @apply flex-none text-muted;
}

.said {
  @apply m-0 typo-body-md leading-relaxed text-pretty whitespace-pre-line;
}

.made {
  @apply mt-auto flex flex-col gap-2;
}

.feeds {
  @apply grid grid-cols-4 gap-2;
}

.feed {
  @apply flex flex-col gap-0.5 rounded-xl bg-sunken px-3 py-2.5;
}

.n {
  @apply typo-heading-md font-extrabold;
}

.label {
  @apply typo-caption leading-snug text-muted;
}
</style>
