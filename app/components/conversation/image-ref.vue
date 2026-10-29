<script lang="ts" setup>
import { FileImage } from "@lucide/vue";

const { number, path } = defineProps<{ number: number; path?: string }>();

const links = useLinks();

const open = (): void => {
  if (path) void links.open(path);
};
</script>

<template>
  <button
    class="ref plain-button focusable"
    :data-tip="path ? 'Open in Files' : undefined"
    :disabled="!path"
    type="button"
    @click="open"
  >
    <UiIcon class="icon" :icon="FileImage" size="xs" />Image {{ number }}
  </button>
</template>

<style scoped>
.ref {
  @apply relative -top-px inline-flex h-5.5 items-center gap-1.25 rounded-full border border-border bg-raised px-2 align-middle typo-caption leading-none font-semibold text-fg transition-colors duration-(--duration-fast) ease-out;
}

.icon {
  @apply flex-none text-muted;
}

@media (hover: hover) and (pointer: fine) {
  .ref:enabled:hover {
    @apply border-border-strong;
  }
}
</style>
