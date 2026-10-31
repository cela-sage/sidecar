<script lang="ts" setup>
import { useResizeObserver } from "@vueuse/core";

const lights = useTemplateRef<HTMLElement>("lights");

// The desktop shell draws macOS's buttons on this spacer, and only the page knows where the row puts it.
useResizeObserver(lights, ([entry]) => {
  const rect = entry?.target.getBoundingClientRect();
  if (rect?.width) sidecarShell()?.placeLights?.({ height: rect.height, width: rect.width, x: rect.x, y: rect.y });
});
</script>

<template>
  <div class="row" aria-label="Window" data-region="window-row" role="toolbar">
    <span ref="lights" class="lights" aria-hidden="true" />
    <ChromeNav />
    <span class="spacer" />
    <slot />
  </div>
</template>

<style scoped>
.row {
  @apply flex h-11 flex-none items-center gap-1.5 pr-2 pl-3;
}

.lights {
  @apply hidden h-3 w-13 flex-none;
}

.shell[data-lights="true"] .row {
  @apply pl-4.5;
}

.shell[data-lights="true"] .lights {
  @apply block;
}

.shell[data-lights="true"] .nav {
  @apply ml-3.5;
}

.shell[data-drags="true"] .row {
  app-region: drag;
}

.shell[data-drags="true"] .row > :not(.spacer, .lights) {
  app-region: no-drag;
}

.spacer {
  @apply min-w-4 flex-1;
}
</style>
