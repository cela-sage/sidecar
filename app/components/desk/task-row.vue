<script lang="ts" setup>
import type { TaskMeta } from "~/utils/tasks";

const { active, line, meta } = defineProps<{ active?: string; line?: string; meta: TaskMeta }>();

const look = computed(() => Tasks.lookOf(meta.task.state));
</script>

<template>
  <NuxtLink
    :id="`desk-task-${meta.slug}`"
    class="task focusable"
    data-region="desk-task"
    data-cmt="task"
    :data-active="meta.slug === active"
    :data-cmt-label="meta.title"
    :data-cmt-tell="`the ${meta.title} task on the desk`"
    :data-look="look"
    :to="`/tasks/${meta.slug}`"
  >
    <span class="head">
      <span class="mark">
        <ClaudeMascot v-if="look === 'running'" :size="18" state="coding" />
        <TaskDot v-else :look="look" />
      </span>
      <span class="name">{{ meta.title || deslug(meta.slug) }}</span>
      <span class="state mono-meta">{{ Tasks.labelOf(meta.task.state) }}</span>
    </span>
    <span v-if="line" class="line" :data-shimmer="look === 'running'">{{ line }}</span>
  </NuxtLink>
</template>

<style scoped>
.task {
  @apply -mx-2 flex flex-col gap-0.5 rounded-field px-2 pt-1 pb-0.5 text-fg no-underline;
}

.task[data-active="true"] {
  @apply bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .task:hover {
    @apply bg-sunken;
  }
}

.head {
  @apply flex min-w-0 items-center gap-2.5 typo-body;
}

.mark {
  @apply flex w-6 flex-none justify-center;
}

.name {
  @apply min-w-0 flex-1 truncate font-semibold;
}

.task[data-look="done"] .name {
  @apply text-muted;
}

.state {
  @apply flex-none text-muted normal-case;
}

.task[data-look="needs"] .state {
  @apply text-error;
}

.line {
  @apply line-clamp-2 pl-8.5 typo-body leading-snug text-pretty text-muted;
}

.line[data-shimmer="true"] {
  @apply shimmer;
}
</style>
