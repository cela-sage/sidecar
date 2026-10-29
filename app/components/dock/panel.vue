<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { ChevronDown, Plus, Terminal } from "@lucide/vue";
import type { DockTab } from "~~/shared/types/dock";
import type { DockProject, DockTool } from "~/stores/dock";
import type { OrgConversation } from "~/utils/org";

interface Kept {
  where: DockProject;
  count: number;
}

const TOOLS: { label: string; value: DockTool }[] = [
  { label: "Terminal", value: "terminal" },
  { label: "Run", value: "run" },
];
const HEIGHT = 300;

const route = useRoute();
const dock = $dock();
const tree = useOrgTree();

const front = computed(() => dock.projectOf(String(route.params.key ?? "")));
const theirs = computed(() => dock.tabsOf(front.value.key));
const shown = computed(() => dock.shownOf(front.value.key));
const isTerminal = computed(() => dock.tool === "terminal");

const kept = computed((): Kept[] => {
  const counts = new Map<string, number>();
  for (const tab of dock.tabs)
    if (tab.kind === "shell" && tab.project !== front.value.key)
      counts.set(tab.project, (counts.get(tab.project) ?? 0) + 1);
  return [...counts].map(([project, count]) => ({ where: dock.groupOf(project), count }));
});

const sessionOf = (tab: DockTab): OrgConversation | undefined =>
  tab.key ? Org.placeOf(tree.value, tab.key)?.row : undefined;

const isOpening = ref(false);

const openShell = async (): Promise<void> => {
  if (isOpening.value) return;
  isOpening.value = true;
  await dock.openShell(front.value).finally(() => (isOpening.value = false));
};

watch(
  () => [dock.isReady, dock.isOpen, dock.tool, front.value.key] as const,
  ([isReady, isOpen, tool]) => {
    if (isReady && isOpen && tool === "terminal" && !theirs.value.length) void openShell();
  },
  { immediate: true },
);

useShortcuts({
  "Alt+F12": () => dock.toggle(),
  "Mod+T": { run: () => void openShell(), when: () => dock.isOpen && isTerminal.value },
});

const pick = (value: DockTool): void => {
  dock.tool = value;
};
</script>

<template>
  <template v-if="dock.isOpen && dock.isReady">
    <PaneResizer
      v-model="dock.height"
      axis="y"
      edge="end"
      :initial="HEIGHT"
      label="Resize the terminal"
      :max="1200"
      :min="140"
    />
    <section
      class="dock"
      data-region="dock"
      :aria-label="`${isTerminal ? 'Terminal' : 'Run'}, ${front.name}`"
      :style="{ height: `${dock.height}px` }"
    >
      <header class="bar">
        <UiSegmented :model-value="dock.tool" :options="TOOLS" @update:model-value="pick" />
        <span class="rule" aria-hidden="true" />
        <span
          class="project"
          :data-tip="
            isTerminal
              ? `${front.name}'s shells: every conversation in ${front.name} shares them`
              : `${front.name}'s runs`
          "
        >
          <OrgAvatar v-if="front.project && front.tint" :project="front.project" :tint="front.tint" />
          <span class="project-name">{{ front.name }}</span>
        </span>
        <div v-if="isTerminal" class="tabs" role="tablist" :aria-label="`${front.name}'s terminals`">
          <button
            v-for="tab in theirs"
            :key="tab.id"
            class="tab"
            role="tab"
            type="button"
            :aria-selected="tab.id === shown?.id"
            :data-kind="tab.kind"
            @click="dock.pick(tab)"
          >
            <template v-if="tab.kind === 'shell'">
              <UiIcon :icon="Terminal" size="xs" />
              {{ tab.title }}
            </template>
            <template v-else>
              <span v-if="sessionOf(tab)?.role" class="role">{{ sessionOf(tab)?.role }}</span>
              {{ sessionOf(tab)?.name ?? tab.key }}
            </template>
          </button>
          <UiIconButton
            :disabled="isOpening"
            :icon="Plus"
            label="New terminal"
            size="xs"
            tip="New terminal · ⌘T"
            @click="openShell"
          />
        </div>
        <span class="spacer" />
        <span
          v-for="one in kept"
          :key="one.where.key"
          class="kept"
          :data-tip="`Switching back to ${one.where.name} shows them again`"
        >
          <OrgAvatar v-if="one.where.project && one.where.tint" :project="one.where.project" :tint="one.where.tint" />
          {{ one.where.name }} · {{ one.count }} {{ one.count === 1 ? "shell" : "shells" }} still running
        </span>
        <UiIconButton :icon="ChevronDown" label="Hide" size="xs" tip="Hide · ⌥F12" @click="dock.isOpen = false" />
      </header>

      <div class="body" data-theme="dark">
        <DockScreen v-for="tab in dock.tabs" :key="tab.id" :is-shown="isTerminal && tab.id === shown?.id" :tab="tab" />
        <UiStateMessage v-if="isTerminal && !shown" class="empty" align="center">
          {{ isOpening ? `Opening a shell in ${front.name}…` : `No shells in ${front.name}` }}
        </UiStateMessage>
        <UiStateMessage v-if="!isTerminal" class="empty" align="center"
          >Nothing is running in {{ front.name }}</UiStateMessage
        >
      </div>
    </section>
  </template>
</template>

<style scoped>
.dock {
  @apply flex flex-none flex-col overflow-hidden border-t border-t-border;
}

.bar {
  @apply flex h-10.5 flex-none items-center gap-2 border-b border-b-border pr-2 pl-2.5;
}

.rule {
  @apply mx-0.5 h-4.5 w-px flex-none bg-border;
}

.project {
  @apply flex flex-none items-center gap-1.5 px-1;
}

.project-name {
  @apply typo-caption-strong font-bold;
}

.tabs {
  @apply flex min-w-0 items-center gap-1 overflow-x-auto;
}

.tab {
  @apply inline-flex h-7 flex-none cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 typo-mono-meta text-muted transition-colors duration-(--duration-fast) ease-out;
}

.tab:hover {
  @apply bg-sunken text-fg;
}

.tab[aria-selected="true"] {
  @apply border-border bg-sunken text-fg;
}

.tab:focus-visible {
  @apply focus-ring;
}

.role {
  @apply rounded-sm bg-canvas px-1.25 py-px typo-mono-pico font-semibold tracking-wide text-muted;
}

.spacer {
  @apply flex-1;
}

.kept {
  @apply inline-flex h-6 flex-none items-center gap-1.5 rounded-full bg-sunken px-2.25 typo-mono-pico tracking-wider text-muted;
}

.body {
  @apply relative min-h-0 flex-1 bg-raised;
}

.empty {
  @apply absolute inset-0;
}

@media (prefers-reduced-motion: reduce) {
  .tab {
    @apply transition-none;
  }
}
</style>
