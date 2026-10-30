<script lang="ts" setup>
import { Ellipsis } from "@lucide/vue";
import type { LiveSession } from "~~/shared/types/session";

const { session } = defineProps<{ session: LiveSession }>();

const LABELS: Record<Face, string> = {
  conversation: "Conversation",
  artifacts: "Artifacts",
  review: "Review",
  files: "Files",
  history: "History",
};

const sc = useSidecar();
const chrome = useChrome();
const review = useReview();
const layout = $layout();
const life = $life();
const conversationMenu = $conversationMenu();

const openMenu = (event: MouseEvent): void =>
  conversationMenu.openFor(event, { key: session.key, title: session.name ?? "" });

// Counted only from what is already held, so the row never reads a face's data before that face opens.
const counts = computed<Partial<Record<Face, number>>>(() => {
  const snapshot = review.snapshot.value;
  const held: [Face, number][] = [
    ["artifacts", Artifacts.listedBy({ catalogue: sc.catalogue.value, session }).length],
    ["review", snapshot?.key === session.key ? snapshot.files.length : 0],
  ];
  return Object.fromEntries(held.filter(([, count]) => count > 0));
});
</script>

<template>
  <nav class="faces" aria-label="Faces of this conversation">
    <div class="tabs" data-region="view-switcher" role="tablist">
      <button
        v-for="face in chrome.view.faces.value"
        :key="face"
        class="tab plain-button focusable"
        role="tab"
        type="button"
        :aria-selected="face === chrome.view.current.value"
        :data-tip="`${LABELS[face]} of this conversation`"
        :data-value="face"
        @click="chrome.view.set(face)"
      >
        {{ LABELS[face] }}
        <span v-if="layout.hasCounts && counts[face]" class="count">{{ counts[face] }}</span>
      </button>
    </div>
    <div class="life">
      <template v-if="session.life === 'killed'">
        <span class="state mono-meta">Killed</span>
        <UiButton :disabled="life.isResuming" size="xs" variant="outline" @click="life.resume(session.key)">
          {{ life.isResuming ? "Resuming" : "Resume" }}
        </UiButton>
      </template>
      <UiIconButton
        :icon="Ellipsis"
        aria-label="Conversation menu"
        data-tip="Conversation menu"
        size="xs"
        @click="openMenu"
      />
    </div>
  </nav>
</template>

<style scoped>
.faces {
  @apply flex h-10 flex-none items-stretch border-b border-b-border px-3.5;
}

.tabs {
  @apply flex items-stretch gap-0.5;
}

.tab {
  @apply inline-flex items-center gap-1.5 border-0 bg-transparent px-2.5 typo-body-strong whitespace-nowrap text-muted transition-[color,box-shadow] duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .tab:hover {
    @apply text-fg;
  }
}

.tab[aria-selected="true"] {
  @apply text-fg inset-shadow-[0_-2px_0_var(--ink)];
}

.count {
  @apply typo-mono-micro font-medium text-muted;
}

.life {
  @apply ml-auto flex items-center gap-2;
}

.state {
  @apply text-muted;
}

@media (prefers-reduced-motion: reduce) {
  .tab {
    @apply transition-none;
  }
}
</style>
