<script lang="ts" setup>
import type { TaskLook } from "~/utils/tasks";

const { look, size = "md" } = defineProps<{ look: TaskLook; size?: "sm" | "md" }>();
</script>

<template>
  <span class="task-dot dot" aria-hidden="true" :data-look="look" :data-size="size" />
</template>

<style scoped>
.task-dot {
  @apply box-border;
}

.task-dot[data-size="sm"] {
  @apply size-1.5;
}

.task-dot[data-look="running"] {
  @apply breathe bg-primary;
}

.task-dot[data-look="waiting"] {
  @apply border-2 border-primary bg-transparent;
}

.task-dot[data-look="needs"] {
  @apply bg-error;
}

.task-dot[data-look="done"] {
  @apply bg-subtle;
}
</style>
