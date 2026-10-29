<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { onClickOutside } from "@vueuse/core";
import type { Component } from "vue";

type Place = "docked" | "folded" | "open" | "listed";

const {
  count,
  icon,
  label,
  listed = false,
  region,
} = defineProps<{
  count?: number;
  icon: Component;
  label: string;
  /** Floating over a grown sheet, so another entry opens without leaving fullscreen. */
  listed?: boolean;
  region: string;
}>();

const layout = $layout();
const { initial, width } = usePaneWidth();
const isOpen = ref(false);
const tool = useTemplateRef<HTMLElement>("tool");
const stripe = useTemplateRef<HTMLElement>("stripe");

const place = computed<Place>(() => {
  if (listed) return "listed";
  if (!layout.isFolded) return "docked";
  return isOpen.value ? "open" : "folded";
});
const shown = computed(() => Math.min(width.value, layout.listCap ?? width.value));

watch(
  () => layout.isFolded,
  () => (isOpen.value = false),
);

onClickOutside(tool, () => (isOpen.value = false), { ignore: [stripe] });
useShortcuts({ Escape: () => (isOpen.value = false) }, { when: () => isOpen.value });
</script>

<template>
  <section class="split" :style="{ '--tool-w': `${shown}px` }">
    <div class="content">
      <slot />
    </div>

    <PaneResizer
      v-if="place === 'docked'"
      v-model="width"
      edge="end"
      :initial="initial"
      :label="`Resize the ${label.toLowerCase()} list`"
    />

    <button
      v-if="layout.isFolded"
      ref="stripe"
      class="stripe plain-button focusable"
      type="button"
      :aria-expanded="isOpen"
      :aria-label="`${isOpen ? 'Hide' : 'Show'} the ${label.toLowerCase()} list`"
      :data-tip="`${label} · ${isOpen ? 'hide' : 'show'} the list`"
      @click="isOpen = !isOpen"
    >
      <UiIcon :icon="icon" size="sm" />
      <span class="name">{{ label }}</span>
      <span v-if="count" class="count">{{ count }}</span>
    </button>

    <aside
      v-show="place !== 'folded'"
      ref="tool"
      class="tool"
      :aria-label="label"
      :data-place="place"
      :data-region="region"
    >
      <slot name="list" />
    </aside>
  </section>
</template>

<style scoped>
.split {
  @apply relative flex h-full min-h-0;
}

.content {
  @apply grid min-w-0 flex-1 grid-cols-1 grid-rows-1;
}

.tool {
  @apply flex min-h-0 flex-col overflow-hidden;
}

.tool[data-place="docked"] {
  @apply w-(--tool-w) max-w-1/2 flex-none border-l border-l-border;
}

.tool[data-place="open"],
.tool[data-place="listed"] {
  @apply z-28 w-80 rounded-box border border-border bg-raised shadow-lg;
}

.tool[data-place="open"] {
  @apply absolute inset-y-2 right-11;
}

.tool[data-place="listed"] {
  @apply fixed top-14 right-2 bottom-2;
}

.stripe {
  @apply flex w-9 flex-none flex-col items-center gap-2 border-0 border-l border-l-border bg-canvas py-3.5 text-muted transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .stripe:hover {
    @apply text-fg;
  }
}

.stripe[aria-expanded="true"] {
  @apply bg-sunken text-fg;
}

.name {
  @apply typo-caption-strong;
  writing-mode: vertical-rl;
}

.count {
  @apply typo-mono-micro;
}

@media (prefers-reduced-motion: reduce) {
  .stripe {
    @apply transition-none;
  }
}
</style>
