<script lang="ts" setup>
import { Check } from "@lucide/vue";
import type { TaskState } from "~~/shared/types/task";
import type { TaskLook } from "~/utils/tasks";

const { state } = defineProps<{ state: TaskState }>();

const LIVE = new Set<string>(["running", "waiting", "needs", "done"]);

const steps = computed(() => Tasks.stepsOf(state));
const isLive = (kind: string): kind is TaskLook => LIVE.has(kind);
</script>

<template>
  <ol class="strip" aria-label="Where it is in its life" data-region="task-strip">
    <template v-for="step in steps" :key="step.label">
      <li v-if="step.joint !== 'none'" class="joint" aria-hidden="true" :data-joint="step.joint" />
      <li
        class="step"
        :aria-current="isLive(step.kind) ? 'step' : undefined"
        :data-kind="step.kind"
        :data-tip="step.tip"
      >
        <UiIcon v-if="step.kind === 'past'" class="check" :icon="Check" size="xs" />
        <TaskDot v-else-if="isLive(step.kind)" :look="step.kind" size="sm" />
        {{ step.label }}
      </li>
    </template>
  </ol>
</template>

<style scoped>
.strip {
  @apply m-0 flex list-none flex-wrap items-center gap-1.5 p-0;
}

.joint {
  @apply h-0.5 w-3 rounded-xs bg-border-strong;
}

.joint[data-joint="primary"] {
  @apply bg-primary;
}

.joint[data-joint="dashed"] {
  @apply h-0 border-t-2 border-dashed border-border-strong bg-transparent;
}

.step {
  @apply box-border inline-flex h-6 items-center gap-1.25 rounded-full border border-border px-2.25 typo-meta font-bold text-fg;
}

.step[data-kind="past"],
.step[data-kind="future"] {
  @apply font-semibold text-muted;
}

.step[data-kind="future"] {
  @apply border-dashed border-border-strong;
}

.step[data-kind="running"] {
  @apply border-primary bg-primary-soft;
}

.step[data-kind="waiting"] {
  @apply border-primary;
}

.step[data-kind="needs"] {
  @apply border-error text-error;
}

.step[data-kind="done"] {
  @apply bg-sunken;
}

.check {
  @apply size-2.75 text-muted;
}
</style>
