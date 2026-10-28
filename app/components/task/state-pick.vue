<script lang="ts" setup>
import type { TaskAssigned } from "~~/shared/types/desk";
import { TaskStatus, type TaskLook, type TaskMeta } from "~/utils/tasks";

const { meta } = defineProps<{ meta: TaskMeta }>();
const task = $task();
const chrome = useChrome();

const LOOK: Record<TaskStatus, TaskLook> = { backlog: "waiting", progress: "running", blocked: "needs", done: "done" };

const look = computed(() => Tasks.lookOf(meta.task.state));
const picks = computed(() => TaskStatus.filter((one) => one !== Tasks.statusOf(meta.task.state)));

async function set(status: TaskStatus, close: () => void): Promise<void> {
  close();
  await $fetch<TaskAssigned>(`/api/tasks/${encodeURIComponent(meta.slug)}`, {
    method: "PATCH",
    body: { state: Tasks.stateFor(status, meta.task) },
  }).catch((error: unknown) =>
    chrome.toast(failReason(error) ?? `Could not move it to ${Tasks.statusLabel(status)}`, "destructive"),
  );
  await Promise.all([task.readTasks(), task.refresh()]);
}
</script>

<template>
  <UiPopover :estimated-height="200" placement="bottom" width="w-56">
    <template #trigger="{ open }">
      <button
        class="chip plain-button focusable"
        data-region="task-state"
        data-tip="Change its status"
        type="button"
        :aria-expanded="open"
        :data-look="look"
      >
        <TaskDot :look="look" size="sm" />{{ Tasks.chipOf(meta.task.state) }}
      </button>
    </template>

    <template #default="{ close }">
      <div class="menu" role="group" aria-label="Task status">
        <p class="head mono-meta">Status</p>
        <UiMenuItem v-for="one in picks" :key="one" @click="set(one, close)">
          <span class="pick"><TaskDot :look="LOOK[one]" size="sm" />{{ Tasks.statusLabel(one) }}</span>
        </UiMenuItem>
      </div>
    </template>
  </UiPopover>
</template>

<style scoped>
.chip {
  @apply box-border inline-flex h-5.5 flex-none items-center gap-1.5 rounded-full border border-transparent bg-raised px-2.25 typo-meta-semibold text-primary-deep;
}

.chip[data-look="running"] {
  @apply bg-primary-soft;
}

.chip[data-look="waiting"] {
  @apply border-primary;
}

.chip[data-look="needs"] {
  @apply border-error text-error;
}

.chip[data-look="done"] {
  @apply bg-sunken text-muted;
}

.menu {
  @apply flex flex-col gap-0.5 p-1.5;
}

.head {
  @apply m-0 px-2 pt-1 pb-1.5 text-subtle;
}

.pick {
  @apply inline-flex items-center gap-2 typo-body text-fg;
}
</style>
