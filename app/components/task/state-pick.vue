<script lang="ts" setup>
import type { TaskAssigned } from "~~/shared/types/desk";
import type { TaskState } from "~~/shared/types/task";
import type { TaskMeta } from "~/utils/tasks";

const { meta } = defineProps<{ meta: TaskMeta }>();
const task = $task();
const chrome = useChrome();
const isAsking = ref(false);
const reason = ref("");

const PICKS: TaskState[] = ["running", "blocked", "waiting", "done", "unassigned"];

const look = computed(() => Tasks.lookOf(meta.task.state));
const picks = computed(() => PICKS.filter((one) => one !== meta.task.state));
const labelOf = (state: TaskState): string => (state === "unassigned" ? "Back to the inbox" : Tasks.chipOf(state));

async function set(state: TaskState, close: () => void): Promise<void> {
  const why = reason.value.trim();
  if (state === "waiting" && !why) {
    isAsking.value = true;
    return;
  }
  close();
  isAsking.value = false;
  reason.value = "";
  await $fetch<TaskAssigned>(`/api/tasks/${encodeURIComponent(meta.slug)}`, {
    method: "PATCH",
    body: { state, ...(state === "waiting" ? { reason: why } : {}) },
  }).catch((error: unknown) =>
    chrome.toast(failReason(error) ?? `Could not move it to ${labelOf(state)}`, "destructive"),
  );
  await Promise.all([task.readTasks(), task.refresh()]);
}
</script>

<template>
  <UiPopover :estimated-height="250" placement="bottom" width="w-60">
    <template #trigger="{ open }">
      <button
        class="chip plain-button focusable"
        data-region="task-state"
        data-tip="Move it by hand"
        type="button"
        :aria-expanded="open"
        :data-look="look"
      >
        <TaskDot :look="look" size="sm" />{{ Tasks.chipOf(meta.task.state) }}
      </button>
    </template>

    <template #default="{ close }">
      <div class="menu" role="group" aria-label="Task state">
        <p class="head mono-meta">Move it by hand</p>
        <UiMenuItem v-for="one in picks" :key="one" @click="set(one, close)">
          <span class="pick"><TaskDot :look="Tasks.lookOf(one)" size="sm" />{{ labelOf(one) }}</span>
        </UiMenuItem>
        <form v-if="isAsking" class="ask" @submit.prevent="set('waiting', close)">
          <UiTextInput v-model="reason" placeholder="What it waits for, then enter" />
        </form>
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

.ask {
  @apply px-1 pt-1;
}
</style>
