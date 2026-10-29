<script lang="ts" setup>
import { ChevronDown, PanelBottom, Play } from "@lucide/vue";
import { Titles } from "~~/shared/utils/titles";
import type { LiveSession } from "~~/shared/types/session";

const { session } = defineProps<{ session: LiveSession }>();

const chrome = useChrome();
const dock = $dock();
const tree = useOrgTree();

const full = computed(() => nameOf(session));
const parsed = computed(() => Titles.parse(full.value));
const group = computed(() => Org.placeOf(tree.value, session.key)?.group);
const title = computed(() => {
  const words = parsed.value?.words.filter((word) => word !== parsed.value?.role) ?? [];
  return words.join(" ") || full.value;
});

const copyId = async (): Promise<void> => {
  await navigator.clipboard
    .writeText(session.key)
    .then(() => chrome.toast(`Copied ${session.key}`))
    .catch(() => chrome.toast("The clipboard refused the copy", "destructive"));
};
</script>

<template>
  <header class="bar" data-region="conversation-header">
    <OrgAvatar v-if="group" class="icon" :project="group.project" :tint="group.tint" />
    <span v-if="parsed?.role" class="role">{{ parsed.role }}</span>
    <h1 class="title" :data-tip="full">{{ title }}</h1>
    <button class="id plain-button focusable" data-tip="Copy id" type="button" @click="copyId">
      {{ session.key }}
    </button>
    <span class="spacer" />
    <div
      class="run"
      data-scaffold
      role="group"
      aria-label="Run configurations"
      data-tip="Run configurations aren't read yet"
    >
      <span class="scaffold-body run-body">
        <button class="run-pick plain-button" aria-haspopup="menu" disabled type="button">
          <span class="run-name">Run</span>
          <UiIcon class="run-chevron" :icon="ChevronDown" size="xs" />
        </button>
        <button class="run-play plain-button" aria-label="Run" disabled type="button">
          <UiIcon :icon="Play" size="xs" />
        </button>
      </span>
    </div>
    <button
      class="terminal plain-button focusable"
      aria-label="Terminal"
      :aria-pressed="dock.isOpen"
      data-region="terminal-toggle"
      data-tip="Terminal · ⌥F12"
      type="button"
      @click="dock.toggle()"
    >
      <UiIcon :icon="PanelBottom" size="sm" />
    </button>
  </header>
</template>

<style scoped>
.bar {
  @apply flex h-14 flex-none items-center gap-2.25 pr-3 pl-4.5;
}

:global(.shell[data-shell="true"]:not([data-full="true"])) .bar {
  app-region: drag;
}

:global(.shell[data-shell="true"]) .bar > :not(.spacer) {
  app-region: no-drag;
}

.icon {
  @apply size-4.5 rounded-md;
}

.role {
  @apply flex-none rounded-md bg-sunken px-1.5 py-0.5 typo-mono-micro font-semibold tracking-wide text-muted;
}

.title {
  @apply m-0 min-w-0 truncate typo-heading font-extrabold text-fg;
}

.id {
  @apply flex-none rounded-md border-0 bg-transparent px-1 py-0.5 typo-mono-micro font-medium text-subtle transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .id:hover {
    @apply bg-sunken text-fg;
  }
}

.spacer {
  @apply min-w-4 flex-1;
}

.run {
  @apply flex-none;
}

.run-body {
  @apply flex h-8.5 items-center gap-0.5 rounded-full border border-border bg-sunken p-0.5;
}

.run-pick {
  @apply inline-flex h-7 items-center gap-1.75 rounded-full border-0 bg-raised px-2.5 text-fg shadow-sm;
}

.run-name {
  @apply typo-caption font-semibold whitespace-nowrap;
}

.run-chevron {
  @apply text-muted;
}

.run-play {
  @apply inline-flex size-7 items-center justify-center rounded-full border-0 bg-transparent p-0 text-success;
}

.terminal {
  @apply inline-flex size-8.5 flex-none items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-muted;
}

.terminal[aria-pressed="true"] {
  @apply border-border-strong bg-sunken text-fg;
}
</style>
