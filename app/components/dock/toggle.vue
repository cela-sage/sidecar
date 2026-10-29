<script lang="ts" setup>
import { PanelBottom } from "@lucide/vue";

const dock = $dock();
</script>

<template>
  <button
    class="toggle plain-button focusable"
    aria-label="Terminal"
    :aria-pressed="dock.isOpen"
    data-region="terminal-toggle"
    data-tip="Terminal · ⌥F12"
    type="button"
    @click="dock.toggle()"
  >
    <UiIcon :icon="PanelBottom" size="md" />
  </button>
</template>

<style scoped>
.toggle {
  @apply inline-flex size-8 flex-none items-center justify-center rounded-lg border border-transparent bg-transparent p-0 text-muted transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .toggle:hover {
    @apply bg-sunken text-fg;
  }
}

.toggle[aria-pressed="true"] {
  @apply border-border-strong bg-sunken text-fg;
}

@media (prefers-reduced-motion: reduce) {
  .toggle {
    @apply transition-none;
  }
}
</style>
