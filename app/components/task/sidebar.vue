<script lang="ts" setup>
import { Check, ChevronDown, ChevronRight, Inbox } from "@lucide/vue";
import type { TaskMeta, TaskSummary } from "~/utils/tasks";

const { current } = defineProps<{ current: string }>();

interface Group {
  key: string;
  name: string;
  tint: string;
  tasks: TaskMeta[];
  summary: TaskSummary;
}

const sc = useSidecar();
const task = $task();
const artifact = $artifact();

const tasks = computed(() => Tasks.of(sc.catalogue.value).sort(Tasks.order));
const open = computed(() => tasks.value.filter((one) => one.task.state !== "done").length);
const inbox = computed(() => tasks.value.filter((one) => one.task.state === "unassigned"));
const needs = computed(() => tasks.value.filter((one) => one.task.state === "blocked").length);

const groups = computed<Group[]>(() => {
  const keys = task.projects.map((one) => one.key);
  for (const one of tasks.value) if (one.task.project && !keys.includes(one.task.project)) keys.push(one.task.project);
  return keys.map((key) => {
    const mine = tasks.value.filter((one) => one.task.project === key);
    return {
      key,
      name: task.projects.find((one) => one.key === key)?.name ?? key,
      tint: Tasks.tintOf(key, keys),
      tasks: mine,
      summary: Tasks.summaryOf(mine),
    };
  });
});

function isOpen(group: Group): boolean {
  return task.opened[group.key] ?? group.tasks.some((one) => one.slug === current || one.task.state !== "done");
}

function toggle(group: Group): void {
  task.opened = { ...task.opened, [group.key]: !isOpen(group) };
}
</script>

<template>
  <UiSurface
    class="sidebar"
    data-region="task-sidebar"
    :data-listed="artifact.isFull && artifact.isListed"
    pad="none"
    variant="raised"
  >
    <header class="bar">
      <span class="title">Tasks</span>
      <span class="meta mono-meta">{{ open }} open</span>
    </header>

    <nav class="scroll" aria-label="Projects and their tasks">
      <NuxtLink class="desk focusable" to="/desk">
        <UiIcon class="desk-icon" :icon="Inbox" size="sm" />
        <span class="desk-name">Desk</span>
        <span v-if="needs" class="needs mono-meta"><span class="dot" />{{ needs }} needs you</span>
        <span class="meta mono-meta">{{ inbox.length }} in the inbox</span>
      </NuxtLink>
      <TaskSidebarRow v-for="one in inbox" :key="one.slug" :current="current" :meta="one" />

      <div class="label mono-meta">Projects</div>
      <div v-for="group in groups" :key="group.key" class="group">
        <button
          class="group-head plain-button focusable"
          type="button"
          :aria-expanded="isOpen(group)"
          @click="toggle(group)"
        >
          <UiIcon class="chevron" :icon="isOpen(group) ? ChevronDown : ChevronRight" size="xs" />
          <span class="square" :data-tint="group.tint" />
          <span class="group-name">{{ group.name }}</span>
          <span class="meta mono-meta" :data-look="group.summary.look">{{ group.summary.text }}</span>
        </button>
        <template v-if="isOpen(group)">
          <TaskSidebarRow v-for="one in group.tasks" :key="one.slug" :current="current" :meta="one" />
        </template>
      </div>
    </nav>

    <footer class="legend" aria-label="What the colours mean">
      <span class="key"><span class="swatch" data-look="running" />runs on its own</span>
      <span class="key"><span class="swatch" data-look="needs" />needs you</span>
      <span class="key"><UiIcon class="decided" :icon="Check" size="xs" />you decided</span>
      <span class="key"><span class="swatch" data-look="done" />done</span>
    </footer>
  </UiSurface>
</template>

<style scoped>
.sidebar {
  @apply flex min-h-0 flex-col overflow-hidden;
}

/* The Artifacts list's place over a grown sheet, so another task opens without leaving fullscreen. */
.sidebar[data-listed="true"] {
  @apply fixed top-14 bottom-2 left-2 z-28 w-85;
}

.bar {
  @apply flex flex-none items-center gap-2 border-b border-b-border py-2 pr-2 pl-3.5;
}

.title {
  @apply typo-body-strong font-bold;
}

.meta {
  @apply text-muted normal-case;
}

.meta[data-look="needs"] {
  @apply text-error;
}

.scroll {
  @apply flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-1.5 pb-(--float-clear);
}

.desk {
  @apply flex h-9 flex-none items-center gap-2.5 rounded-field border border-transparent px-2.5 text-fg no-underline transition-colors duration-(--duration-fast) ease-out;
}

.desk-icon {
  @apply text-muted;
}

.desk-name {
  @apply flex-1 typo-body font-semibold;
}

.needs {
  @apply inline-flex items-center gap-1.25 text-error normal-case;
}

.needs .dot {
  @apply size-1.5 bg-error;
}

.label {
  @apply px-2.5 pt-3 pb-1 text-subtle;
}

.group {
  @apply flex flex-none flex-col gap-px;
}

.group-head {
  @apply flex h-8 w-full items-center gap-2 rounded-field border-0 bg-transparent pr-2.5 pl-1.5 text-left text-fg transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .desk:hover,
  .group-head:hover {
    @apply bg-sunken;
  }
}

.chevron {
  @apply flex-none text-muted;
}

.square {
  @apply size-2.25 flex-none rounded-sm bg-tint;
}

.group-name {
  @apply min-w-0 flex-1 typo-body font-semibold;
}

.legend {
  @apply flex flex-none flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-t-border px-3.5 py-2.5 typo-meta text-muted;
}

.key {
  @apply inline-flex items-center gap-1.5;
}

.swatch {
  @apply dot;
}

.swatch[data-look="running"] {
  @apply bg-primary;
}

.swatch[data-look="needs"] {
  @apply bg-error;
}

.swatch[data-look="done"] {
  @apply bg-subtle;
}

.decided {
  @apply size-2.5 text-fg;
}
</style>
