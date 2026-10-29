<script lang="ts" setup>
import { useResizeObserver } from "@vueuse/core";

const lights = useTemplateRef<HTMLElement>("lights");

// The desktop shell draws macOS's buttons on this spacer, and only the page knows where the bar puts it.
useResizeObserver(lights, ([entry]) => {
  const rect = entry?.target.getBoundingClientRect();
  if (rect?.width) sidecarShell()?.placeLights?.({ height: rect.height, width: rect.width, x: rect.x, y: rect.y });
});
</script>

<template>
  <header class="bar" aria-label="Window" data-region="window-bar" role="toolbar">
    <span ref="lights" class="lights" aria-hidden="true" />
    <span class="spacer" />
    <slot />
  </header>
</template>

<style scoped>
.bar {
  @apply flex h-11 flex-none items-center gap-1.5 border-b border-b-border bg-canvas pr-2.5 pl-3;
}

.lights {
  @apply hidden h-3 w-13 flex-none;
}

.shell[data-shell="true"]:not([data-fullscreen="true"]) .bar {
  @apply pl-4.5;
}

.shell[data-shell="true"]:not([data-fullscreen="true"]) .lights {
  @apply block;
}

/* Never :global() here: Vue's scoped compiler keeps only what is inside it, which made the whole shell the drag region. */
.shell[data-shell="true"]:not([data-full="true"]) .bar {
  app-region: drag;
}

.shell[data-shell="true"] .bar > :not(.spacer, .lights) {
  app-region: no-drag;
}

.spacer {
  @apply min-w-4 flex-1;
}
</style>
