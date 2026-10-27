<script lang="ts" setup>
import { ChevronDown, Copy, Terminal } from "@lucide/vue";
import { onClickOutside } from "@vueuse/core";

const COMMAND = "sidecar terminal";

const chrome = useChrome();
const root = useTemplateRef<HTMLElement>("root");
const isOpen = ref(false);

onClickOutside(root, () => (isOpen.value = false));

async function copy(): Promise<void> {
  await navigator.clipboard
    .writeText(COMMAND)
    .then(() => chrome.toast("Copied sidecar terminal"))
    .catch(() => chrome.toast("The clipboard refused the copy", "destructive"));
}
</script>

<template>
  <div ref="root" class="terminal" data-region="terminal-pill">
    <UiSurface v-island-pop="'top right'" class="pill" pad="none" shape="pill" variant="glass-liquid">
      <button
        class="open plain-button focusable"
        type="button"
        aria-haspopup="dialog"
        data-tip="sidecar terminal isn't running, so the sidecar can't switch your terminal"
        :aria-expanded="isOpen"
        @click="isOpen = !isOpen"
      >
        <UiIcon :icon="Terminal" size="xs" />
        <span class="label mono-meta">Terminal</span>
        <span class="held">not followed</span>
        <UiIcon class="chevron" :icon="ChevronDown" size="xs" />
      </button>
    </UiSurface>
    <UiSurface v-if="isOpen" class="note" pad="none" role="note" variant="raised">
      <span class="line">
        The sidecar switches your terminal through a follower you start once, in the terminal you use for Claude Code.
      </span>
      <span class="command">
        <code>{{ COMMAND }}</code>
        <UiIconButton :icon="Copy" label="Copy" size="sm" @click="copy" />
      </span>
    </UiSurface>
  </div>
</template>

<style scoped>
.terminal {
  @apply relative flex-none;
}

.pill {
  @apply island-row px-1;
}

.open {
  @apply flex h-full items-center gap-2 rounded-full border-0 bg-transparent px-2 text-fg;
}

.label {
  @apply text-muted;
}

.held {
  @apply typo-caption-strong whitespace-nowrap text-muted;
}

.chevron {
  @apply text-muted;
}

.note {
  @apply absolute top-12 right-0 z-5 box-border flex w-90 origin-top-right flex-col gap-2.5 rounded-2xl px-3.5 py-3 settle shadow-lg;
}

.line {
  @apply typo-body leading-normal text-pretty;
}

.command {
  @apply flex items-center gap-2 rounded-field bg-sunken py-1 pr-1 pl-3;
}

code {
  @apply flex-1 font-mono typo-caption text-fg;
}
</style>
