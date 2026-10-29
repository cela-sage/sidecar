<script lang="ts" setup>
import { PanelBottom } from "@lucide/vue";
import { Titles } from "~~/shared/utils/titles";
import type { LiveSession } from "~~/shared/types/session";

const { session } = defineProps<{ session: LiveSession }>();

const chrome = useChrome();
const dock = $dock();
const tree = useOrgTree();

const full = computed(() => nameOf(session));
const parsed = computed(() => Titles.parse(full.value));
const group = computed(() => Org.placeOf(tree.value, session.key)?.group);
const where = computed(() => dock.projectOf(session.key));
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
    <RunWidget v-if="where.project" :cwd="session.cwd" :project="where" />
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

/* Never :global() here: Vue's scoped compiler keeps only what is inside it, which made the whole shell the drag region. */
.shell[data-shell="true"]:not([data-full="true"]) .bar {
  app-region: drag;
}

.shell[data-shell="true"] .bar > :not(.spacer) {
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

.terminal {
  @apply inline-flex size-8.5 flex-none items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-muted;
}

.terminal[aria-pressed="true"] {
  @apply border-border-strong bg-sunken text-fg;
}
</style>
