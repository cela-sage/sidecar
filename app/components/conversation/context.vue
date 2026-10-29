<script lang="ts" setup>
const { isBusy } = defineProps<{ isBusy: boolean }>();

const usage = $usage();

const CIRCUMFERENCE = 2 * Math.PI * 6;

const context = computed(() => usage.front?.context);
const percent = computed(() => Math.round(context.value?.percent ?? 0));
const dash = computed(() => `${((percent.value / 100) * CIRCUMFERENCE).toFixed(1)} ${CIRCUMFERENCE}`);
const tip = computed(() =>
  context.value?.tokens
    ? `Context · ${Usage.kilo(context.value.tokens)} of ${Usage.kilo(context.value.window)} tokens`
    : "Context",
);
</script>

<template>
  <UiPopover v-if="usage.front" placement="top" width="w-80" :estimated-height="380">
    <template #trigger="{ open }">
      <button
        class="meter plain-button focusable"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :aria-label="usage.isCompacting ? 'Context, compacting' : `Context, ${percent}% used`"
        :data-tip="tip"
        type="button"
      >
        <svg v-if="usage.isCompacting" class="spin spinner" viewBox="0 0 12 12" aria-hidden="true">
          <circle class="track" cx="6" cy="6" r="4.5" />
          <path class="arc" d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" />
        </svg>
        <svg v-else class="ring" viewBox="0 0 16 16" aria-hidden="true">
          <circle class="track" cx="8" cy="8" r="6" />
          <circle class="arc" cx="8" cy="8" r="6" :stroke-dasharray="dash" />
        </svg>
        <span :class="{ shimmer: usage.isCompacting }">{{ usage.isCompacting ? "Compacting" : `${percent}%` }}</span>
      </button>
    </template>
    <template #default="{ close }">
      <ConversationContextPanel :is-busy="isBusy" @done="close" />
    </template>
  </UiPopover>
</template>

<style scoped>
.meter {
  @apply inline-flex h-7 items-center gap-1.5 rounded-full border border-transparent bg-transparent pr-2.25 pl-1.75 typo-mono-meta font-medium whitespace-nowrap text-muted transition-colors duration-(--duration-fast) ease-out;
}

.meter[aria-expanded="true"] {
  @apply border-border-strong bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .meter:hover {
    @apply bg-sunken text-fg;
  }
}

svg {
  @apply flex-none fill-none;
}

.ring {
  @apply size-3.5 -rotate-90;
}

.spin {
  @apply size-3;
}

.track {
  @apply stroke-border-strong;
  stroke-width: 2.2;
}

.arc {
  @apply stroke-fg;
  stroke-width: 2.2;
  stroke-linecap: round;
}

.spin .track,
.spin .arc {
  stroke-width: 1.75;
}
</style>
