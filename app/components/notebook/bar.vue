<script lang="ts" setup>
import { Play, RotateCcw, Square } from "@lucide/vue";
import type { NotebookView } from "~/composables/useNotebook";
import type { KernelState } from "~~/shared/types/notebook";

const { view } = defineProps<{ view: NotebookView }>();

const LABEL: Record<KernelState, string> = {
  busy: "Running",
  dead: "Kernel stopped",
  idle: "Idle",
  missing: "No Jupyter",
  off: "No kernel yet",
  starting: "Starting the kernel…",
};

const kernel = computed(() => view.kernel.value);
const canRun = computed(() => kernel.value !== "missing");
const hasKernel = computed(() => !["missing", "off"].includes(kernel.value));
</script>

<template>
  <div class="bar" data-region="notebook-bar">
    <span class="kernel" :data-state="kernel">
      <span class="light" />
      {{ LABEL[kernel] }}
    </span>
    <span v-if="view.note.value" class="note" :data-tip="view.note.value">{{ view.note.value }}</span>
    <span class="spacer" />
    <UiButton
      data-tip="Run every code cell from the top"
      :disabled="!canRun"
      :icon="Play"
      size="xs"
      variant="outline"
      @click="view.runAll"
    >
      Run all
    </UiButton>
    <UiButton
      data-tip="Stop the running cell and drop the queue"
      :disabled="!view.isRunning.value"
      :icon="Square"
      size="xs"
      variant="ghost"
      @click="view.interrupt"
    >
      Interrupt
    </UiButton>
    <UiButton
      data-tip="Start the kernel over, losing every variable"
      :disabled="!hasKernel"
      :icon="RotateCcw"
      size="xs"
      variant="ghost"
      @click="view.restart"
    >
      Restart
    </UiButton>
  </div>
</template>

<style scoped>
/* Held at the top of the pane, so Run all and Interrupt stay in reach down a long notebook. */
.bar {
  @apply sticky top-0 z-2 mx-auto flex w-full max-w-(--page-w) items-center gap-2 border-b border-b-border bg-raised px-(--gutter) py-2;
}

.kernel {
  @apply flex flex-none items-center gap-1.5 typo-meta-strong whitespace-nowrap text-muted;
}

.light {
  @apply dot bg-subtle;
}

.kernel[data-state="idle"] .light {
  @apply bg-success;
}

.kernel[data-state="busy"] .light,
.kernel[data-state="starting"] .light {
  @apply animate-pulse bg-primary;
}

.kernel[data-state="dead"] .light,
.kernel[data-state="missing"] .light {
  @apply bg-error;
}

.note {
  @apply min-w-0 truncate typo-caption text-muted;
}

.spacer {
  @apply flex-1;
}

@media (prefers-reduced-motion: reduce) {
  .kernel .light {
    @apply animate-none;
  }
}
</style>
