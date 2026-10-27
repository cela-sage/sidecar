<script lang="ts" setup>
import type { Mark } from "~/utils/org";

const { mark } = defineProps<{ mark: Mark }>();

const LABEL: Record<Mark, string> = {
  working: "Working",
  needs: "Needs you",
  waits: "Waits on your input",
  third: "Waits on someone else",
  queued: "Not started",
  completed: "Completed",
  done: "Done",
};
</script>

<template>
  <span class="mark" role="img" :aria-label="LABEL[mark]" :data-mark="mark">
    <svg v-if="mark === 'working'" class="spin spinner" viewBox="0 0 12 12" aria-hidden="true">
      <circle class="track" cx="6" cy="6" r="4.5" />
      <path class="arc" d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" />
    </svg>
    <svg v-else-if="mark === 'needs' || mark === 'waits'" class="alert" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="6" />
      <path d="M6 3.1v3.4" />
      <circle class="point" cx="6" cy="8.7" r="0.95" />
    </svg>
    <svg v-else-if="mark === 'third'" class="clock" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="4.9" />
      <path d="M6 3.6V6l1.6 1.1" />
    </svg>
    <svg v-else-if="mark === 'queued'" class="hollow" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="2.75" />
    </svg>
    <svg v-else class="check" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.4 6.3 4.9 8.7 9.6 3.6" />
    </svg>
  </span>
</template>

<style scoped>
.mark {
  @apply inline-flex size-3 flex-none items-center justify-center;
}

svg {
  @apply size-3 fill-none;
}

.spin {
  @apply size-2.75;
}

.track {
  @apply stroke-border-strong;
  stroke-width: 1.75;
}

.arc {
  @apply stroke-primary;
  stroke-width: 1.75;
  stroke-linecap: round;
}

.alert circle {
  @apply fill-error;
}

.mark[data-mark="waits"] .alert circle {
  @apply fill-warning;
}

.alert path {
  @apply stroke-primary-content;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.alert .point {
  @apply fill-primary-content;
}

.clock {
  @apply stroke-primary;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.hollow {
  @apply stroke-muted;
  stroke-width: 1.5;
}

.check {
  @apply stroke-subtle;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
