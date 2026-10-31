<script lang="ts" setup>
import { Hash } from "@lucide/vue";
import type { ChannelTab } from "~/utils/channel-view";

const sc = useSidecar();
const task = $task();
const channel = $channel();

const CREW_MAX = 5;

const meta = computed(() => Tasks.of(sc.catalogue.value).find((one) => one.slug === task.slug));
const title = computed(() => channel.room?.title || meta.value?.title || deslug(task.slug ?? ""));
const crew = computed(() => (channel.room ? ChannelView.crewOf(channel.room, channel.cast) : undefined));
const isArchived = computed(() => !!channel.room?.archived);
const isWorkstream = computed(() => !!meta.value?.task.project);

const chip = computed(() => {
  if (isArchived.value) return "Archived";
  return isWorkstream.value ? "Temporary" : "Backlog";
});

const topic = computed(() => {
  if (isArchived.value) return `Workstream · ${title.value} · archived, read only`;
  if (isWorkstream.value) return `Workstream · ${title.value} · closes when it ships`;
  return `${title.value} · in the backlog until a project takes it`;
});

const tabs = computed((): { value: ChannelTab; label: string; tip: string; count?: number }[] => [
  { value: "messages", label: "Messages", tip: "The channel" },
  { value: "dms", label: "DMs", tip: "DMs between the channel's agents", count: channel.room?.dms.length },
  { value: "document", label: "Document", tip: "The workstream's document and its history" },
]);
</script>

<template>
  <section class="front" :aria-label="`#${task.slug}`" data-region="channel-front">
    <header class="head">
      <UiIcon class="hash" :icon="Hash" size="md" />
      <span class="name">{{ task.slug }}</span>
      <span class="chip">{{ chip }}</span>
      <span class="topic" data-tip="A temporary channel for the workstream. Agents spawned for it join on their own">{{
        topic
      }}</span>
      <span v-if="crew?.speakers.length" class="crew" :data-tip="crew.tip">
        <span class="stack">
          <ChannelFace
            v-for="one in crew.speakers.slice(0, CREW_MAX)"
            :key="one.key"
            is-stacked
            :size="20"
            :speaker="one"
          />
        </span>
        <span class="crew-count">{{ crew.speakers.length }}</span>
      </span>
    </header>

    <div class="tabs" role="tablist" aria-label="Channel">
      <button
        v-for="one in tabs"
        :key="one.value"
        class="tab plain-button focusable"
        role="tab"
        type="button"
        :aria-selected="channel.tab === one.value"
        :data-tip="one.tip"
        @click="channel.tab = one.value"
      >
        {{ one.label }}<span v-if="one.count" class="count">{{ one.count }}</span>
      </button>
    </div>

    <div class="body">
      <ChannelMessages v-if="channel.tab === 'messages'" :meta="meta" />
      <ChannelDms v-else-if="channel.tab === 'dms'" />
      <TaskFront v-else />
    </div>
  </section>
</template>

<style scoped>
.front {
  @apply absolute inset-0 flex flex-col bg-raised;
}

.head {
  @apply flex h-13 flex-none items-center gap-2.5 pr-3.5 pl-5;
}

.hash {
  @apply flex-none text-muted;
}

.name {
  @apply flex-none typo-heading font-extrabold tracking-tight;
}

.chip {
  @apply flex-none rounded-full bg-sunken px-1.75 py-0.5 typo-mono-pico font-semibold tracking-widest text-muted uppercase;
}

.topic {
  @apply min-w-0 flex-1 truncate typo-caption text-muted;
}

.crew {
  @apply inline-flex h-7.5 flex-none items-center gap-2 rounded-full border border-border pr-2.5 pl-2;
}

.stack {
  @apply inline-flex items-center;
}

.stack > :not(:first-child) {
  @apply -ml-1.25;
}

.crew-count {
  @apply typo-mono-micro font-semibold text-fg;
}

.tabs {
  @apply flex h-10 flex-none items-stretch gap-0.5 border-b border-b-border px-2.5;
}

.tab {
  @apply inline-flex items-center gap-1.5 border-0 bg-transparent px-2.5 typo-body-strong whitespace-nowrap text-muted transition-[color,box-shadow] duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .tab:hover {
    @apply text-fg;
  }
}

.tab[aria-selected="true"] {
  @apply text-fg inset-shadow-[0_-2px_0_var(--ink)];
}

.count {
  @apply typo-mono-micro font-medium text-muted;
}

.body {
  @apply relative flex min-h-0 flex-1;
}

@media (prefers-reduced-motion: reduce) {
  .tab {
    @apply transition-none;
  }
}
</style>
