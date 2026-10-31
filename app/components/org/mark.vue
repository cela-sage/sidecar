<script lang="ts">
import type { Mark } from "~/utils/org";

export const MARK_LABEL: Record<Mark, string> = {
  raised: "Raised to you",
  working: "Working",
  needs: "Needs you",
  waits: "Waits on your input",
  third: "Waits on someone else",
  queued: "Not started",
  unseen: "Finished, not opened yet",
  completed: "Completed",
  killed: "Killed",
  archived: "Archived",
};
</script>

<script lang="ts" setup>
const { mark } = defineProps<{ mark: Mark }>();
</script>

<template>
  <span class="mark" role="img" :aria-label="MARK_LABEL[mark]" :data-mark="mark">
    <svg v-if="mark === 'raised'" class="at" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="6" />
      <g transform="translate(2.2 2.2) scale(0.317)">
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
      </g>
    </svg>
    <svg v-else-if="mark === 'working'" class="spin spinner" viewBox="0 0 12 12" aria-hidden="true">
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
    <svg v-else-if="mark === 'unseen'" class="dot" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" />
    </svg>
    <svg v-else-if="mark === 'killed'" class="halt" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="3.25" y="3.25" width="5.5" height="5.5" rx="1.25" />
    </svg>
    <svg v-else-if="mark === 'archived'" class="archive" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
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

.at > circle {
  @apply fill-error;
}

.at g {
  @apply stroke-primary-content;
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-linejoin: round;
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

.dot circle {
  @apply fill-primary;
}

.halt rect {
  @apply fill-subtle;
}

.archive {
  @apply stroke-subtle;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.check {
  @apply stroke-subtle;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
