<script lang="ts" setup>
import type { TaskMeta } from "~/utils/tasks";

const { current, meta } = defineProps<{ current: string; meta: TaskMeta }>();

const look = computed(() => Tasks.lookOf(meta.task.state));
</script>

<template>
  <NuxtLink
    class="row focusable"
    data-region="task-row"
    :aria-current="meta.slug === current ? 'page' : undefined"
    :data-current="meta.slug === current"
    :data-look="look"
    :to="`/tasks/${meta.slug}`"
  >
    <TaskDot :look="look" />
    <span class="name">{{ meta.title || deslug(meta.slug) }}</span>
    <span class="state">{{ Tasks.labelOf(meta.task.state) }}</span>
  </NuxtLink>
</template>

<style scoped>
.row {
  @apply flex h-7.5 flex-none items-center gap-2.25 rounded-lg border border-transparent pr-2.5 pl-7.5 text-fg no-underline transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .row:hover {
    @apply bg-sunken;
  }
}

.row[data-current="true"] {
  @apply border-border-strong bg-sunken;
}

.row[data-look="done"] {
  @apply text-muted;
}

.name {
  @apply min-w-0 flex-1 truncate typo-body font-medium;
}

.row[data-current="true"] .name {
  @apply font-bold;
}

.state {
  @apply flex-none typo-mono-micro text-muted;
}

.row[data-look="needs"] .state {
  @apply text-error;
}
</style>
