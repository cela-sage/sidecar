<script lang="ts" setup>
import { Check } from "@lucide/vue";
import type { TaskState } from "~~/shared/types/task";
import type { TaskLook, TaskMeta, TaskStep } from "~/utils/tasks";
import type { TaskStory } from "~/utils/timeline";

const { meta, status, story = {} } = defineProps<{ meta: TaskMeta; status: TaskState; story?: TaskStory }>();

const LIVE = new Set<string>(["running", "waiting", "needs", "archived"]);

const task = $task();
const chrome = useChrome();
const tree = useOrgTree();
const moving = ref<TaskState>();

const steps = computed(() => Tasks.stepsOf(status, story));
const alive = computed(() => Org.aliveOf(Org.taskIn(tree.value, meta.slug)?.leads ?? []).length);
const isLive = (kind: string): kind is TaskLook => LIVE.has(kind);
const isHeld = (step: TaskStep): boolean => !!step.state && Workstreams.isArchived(step.state) && !!alive.value;
const canMove = (step: TaskStep): step is TaskStep & { state: TaskState } =>
  !!step.state &&
  step.state !== meta.task.state &&
  step.state !== "unassigned" &&
  !!meta.task.project &&
  !isHeld(step);

const tipOf = (step: TaskStep): string => {
  if (isHeld(step) && step.state !== meta.task.state) return "Kill its agents first";
  if (canMove(step)) return `Move it to ${step.label} · ${step.tip}`;
  if (step.state && step.state !== meta.task.state && !meta.task.project)
    return `${step.tip}. Drag it onto a project in the tree first`;
  return step.tip;
};

const move = async (state: TaskState, label: string): Promise<void> => {
  moving.value = state;
  await task
    .move(meta.slug, state)
    .catch((error: unknown) => chrome.toast(failReason(error) ?? `Could not move it to ${label}`, "destructive"));
  moving.value = undefined;
};
</script>

<template>
  <ol class="strip" aria-label="Where it is in its life" data-region="task-strip" :data-moving="!!moving">
    <template v-for="step in steps" :key="step.label">
      <li v-if="step.joint !== 'none'" class="joint" aria-hidden="true" :data-joint="step.joint" />
      <li class="slot" :aria-current="isLive(step.kind) ? 'step' : undefined">
        <button
          v-if="canMove(step)"
          class="step plain-button focusable"
          type="button"
          :data-kind="step.kind"
          :data-tip="tipOf(step)"
          :disabled="!!moving"
          @click="move(step.state, step.label)"
        >
          <UiIcon v-if="step.kind === 'past'" class="check" :icon="Check" size="xs" />
          {{ step.label }}
        </button>
        <span v-else class="step" :data-kind="step.kind" :data-tip="tipOf(step)">
          <UiIcon v-if="step.kind === 'past' || step.kind === 'decided'" class="check" :icon="Check" size="xs" />
          <TaskDot v-else-if="isLive(step.kind)" :look="step.kind" size="sm" />
          {{ step.label }}
        </span>
      </li>
    </template>
  </ol>
</template>

<style scoped>
.strip {
  @apply m-0 flex list-none flex-wrap items-center gap-1.5 p-0;
}

.slot {
  @apply flex;
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
  @apply box-border inline-flex h-6 items-center gap-1.25 rounded-full border border-border bg-transparent px-2.25 typo-meta font-bold text-fg;
}

button.step {
  @apply cursor-pointer transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  button.step:hover {
    @apply border-primary bg-primary-soft text-primary-deep;
  }
}

button.step:disabled {
  @apply cursor-progress;
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

.step[data-kind="archived"] {
  @apply bg-sunken;
}

.step[data-kind="decided"] {
  @apply border-border-strong bg-sunken;
}

.check {
  @apply size-2.75 text-muted;
}

.step[data-kind="decided"] .check {
  @apply text-fg;
}
</style>
