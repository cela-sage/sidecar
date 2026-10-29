<script lang="ts" setup>
import type { RunStatus } from "~~/shared/types/runs";

const { status } = defineProps<{ status?: RunStatus }>();
</script>

<template>
  <span v-if="status === 'running'" class="live" role="img" aria-label="Running" />
  <svg v-else-if="status === 'failed'" class="failed" viewBox="0 0 12 12" role="img" aria-label="Failed">
    <circle class="disc" cx="6" cy="6" r="6" />
    <path class="bang" d="M6 3.1v3.4" />
    <circle class="dot" cx="6" cy="8.7" r="0.95" />
  </svg>
</template>

<style scoped>
.live {
  @apply breathe size-1.75 flex-none rounded-full bg-success;
}

.failed {
  @apply size-3 flex-none;
}

.disc {
  @apply fill-error;
}

.bang {
  @apply fill-none stroke-primary-content;
  stroke-linecap: round;
  stroke-width: 1.6;
}

.dot {
  @apply fill-primary-content;
}
</style>
