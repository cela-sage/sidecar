<script lang="ts" setup>
import { ChevronDown, ChevronRight } from "@lucide/vue";

const { depth, fold, label } = defineProps<{ depth: number; fold: string; label: string }>();

const folds = useOrgFolds();
const isOpen = computed(() => folds.isOpen(fold));
</script>

<template>
  <button
    class="fold plain-button focusable"
    type="button"
    :aria-expanded="isOpen"
    :data-depth="depth"
    @click="folds.toggle(fold, isOpen)"
  >
    <OrgGuides :depth="depth" />
    <UiIcon :icon="isOpen ? ChevronDown : ChevronRight" size="xs" />
    <span class="mono-meta">{{ label }}</span>
  </button>
</template>

<style scoped>
.fold {
  @apply relative box-border flex h-6 flex-none items-center gap-1.5 self-start rounded-lg border-0 bg-transparent pr-2 pl-7 text-muted;
}

.fold[data-depth="2"] {
  @apply pl-14;
}

@media (hover: hover) and (pointer: fine) {
  .fold:hover {
    @apply bg-sunken;
  }
}
</style>
