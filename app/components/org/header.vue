<script lang="ts" setup>
import { Plus } from "@lucide/vue";

const desk = $desk();
</script>

<template>
  <header class="bar" data-region="org-header">
    <span class="lights" aria-hidden="true" />
    <ChromeFollowToggle />
    <span class="spacer" />
    <UiIconButton
      aria-label="New task"
      data-region="org-new-task"
      data-tip="New task · {N}"
      :icon="Plus"
      size="md"
      @click="desk.isNaming = true"
    />
    <ChromeThemeToggle shape="inset" />
  </header>
</template>

<style scoped>
/* The traffic lights' row, so its middle stays where the desktop shell draws them. */
.bar {
  @apply flex h-(--island-row-h) flex-none items-center gap-1 border-b border-b-border px-2;
}

.lights {
  @apply hidden h-3 w-14 flex-none;
}

:global(.shell[data-shell="true"]) .lights {
  @apply block;
}

/* On the desktop shell this row is the title bar: it drags the window, and a double click does what System Settings says. */
:global(.shell[data-shell="true"]:not([data-full="true"])) .bar {
  app-region: drag;
}

:global(.shell[data-shell="true"]) .bar > :not(.spacer, .lights) {
  app-region: no-drag;
}

.spacer {
  @apply flex-1;
}
</style>
