<script lang="ts" setup>
import { Plus } from "@lucide/vue";

const desk = $desk();
</script>

<template>
  <div class="tools" role="group" aria-label="Sidecar tools">
    <UiIconButton
      aria-label="New workstream"
      data-region="org-new-task"
      data-tip="New workstream · {N}"
      :icon="Plus"
      size="sm"
      @click="desk.isNaming = true"
    />
    <ChromeDetailToggle shape="inset" size="sm" />
    <ChromeThemeToggle shape="inset" size="sm" />
  </div>
</template>

<style scoped>
.tools {
  @apply flex flex-none items-center gap-0.5;
}

.tools :deep(.icon-button[data-variant="ghost"]:hover) {
  @apply bg-sunken;
}
</style>
