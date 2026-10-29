<script lang="ts" setup>
import { X } from "@lucide/vue";
import type { Component } from "vue";

const { icon, label, tip } = defineProps<{ icon: Component; label: string; tip?: string }>();
const emit = defineEmits<{ remove: [] }>();
</script>

<template>
  <span class="piece" :data-tip="tip">
    <UiIcon class="piece-icon" :icon="icon" size="xs" />
    <span class="piece-label">{{ label }}</span>
    <button
      class="remove plain-button focusable"
      aria-label="Remove"
      data-tip="Remove"
      type="button"
      @click="emit('remove')"
    >
      <UiIcon :icon="X" size="xs" />
    </button>
  </span>
</template>

<style scoped>
.piece {
  @apply inline-flex h-7 max-w-full items-center gap-1.75 rounded-lg border border-border bg-sunken pr-1 pl-2.25;
}

.piece-icon {
  @apply flex-none text-muted;
}

.piece-label {
  @apply min-w-0 truncate typo-caption font-semibold;
}

.remove {
  @apply inline-flex size-5 flex-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted;
}

@media (hover: hover) and (pointer: fine) {
  .remove:hover {
    @apply bg-raised text-fg;
  }
}
</style>
