<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { ChevronDown, Plus, Terminal, X } from "@lucide/vue";
import type { DockTab } from "~~/shared/types/dock";
import type { DockProject, DockTool } from "~/stores/dock";

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

const front = computed(() => dock.projectOf(String(route.params.key ?? "")));
const theirs = computed(() => dock.tabsOf(front.value.key, dock.tool));
const shown = computed(() => dock.shownOf(front.value.key, dock.tool));
const isTerminal = computed(() => dock.tool === "terminal");
const failing = computed(() => (shown.value?.status === "failed" ? (shown.value.failing ?? []) : []));

const kept = computed((): Kept[] => {
  const counts = new Map<string, number>();
  for (const tab of dock.tabs)
    if (tab.kind === "shell" && tab.project !== front.value.key)
      counts.set(tab.project, (counts.get(tab.project) ?? 0) + 1);
  return [...counts].map(([project, count]) => ({ where: dock.groupOf(project), count }));
});

const dragging = ref<DockTab>();
const hover = ref<{ id: string; side: "before" | "after" }>();

const carry = (event: DragEvent, tab: DockTab): void => {
  event.dataTransfer?.setData("application/x-sidecar-dock-tab", tab.id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  requestAnimationFrame(() => (dragging.value = tab));
};

const letGo = (): void => {
  dragging.value = undefined;
  hover.value = undefined;
};

const over = (event: DragEvent, tab: DockTab): void => {
  const el = event.currentTarget;
  if (!dragging.value || !(el instanceof HTMLElement)) return;
  event.preventDefault();
  if (tab.id === dragging.value.id) return void (hover.value = undefined);
  const { left, width } = el.getBoundingClientRect();
  hover.value = { id: tab.id, side: event.clientX < left + width / 2 ? "before" : "after" };
};

const drop = (event: DragEvent, tab: DockTab): void => {
  const moved = dragging.value;
  const side = hover.value?.side;
  letGo();
  if (!moved || !side) return;
  event.preventDefault();
  const others = theirs.value.filter((one) => one.id !== moved.id);
  dock.move(moved, others.findIndex((one) => one.id === tab.id) + (side === "after" ? 1 : 0));
};

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
        <div
          class="tabs"
          role="tablist"
          :aria-label="isTerminal ? `${front.name}'s terminals` : `${front.name}'s runs`"
        >
          <div
            v-for="tab in theirs"
            :key="tab.id"
            class="tab"
            role="presentation"
            :data-dragging="dragging?.id === tab.id"
            :data-drop="hover?.id === tab.id ? hover.side : undefined"
            :data-selected="tab.id === shown?.id"
            @dragleave="hover = undefined"
            @dragover="over($event, tab)"
            @drop="drop($event, tab)"
          >
            <button
              class="label"
              draggable="true"
              role="tab"
              type="button"
              :aria-selected="tab.id === shown?.id"
              :data-kind="tab.kind"
              @click="dock.pick(tab)"
              @dragend="letGo"
              @dragstart="carry($event, tab)"
            >
              <template v-if="tab.kind === 'shell'">
                <UiIcon :icon="Terminal" size="xs" />
                {{ tab.title }}
              </template>
              <template v-else-if="tab.kind === 'run'">
                <RunStatusMark :status="tab.status" />
                {{ tab.title }}
              </template>
              <template v-else>
                <span v-if="dock.sessionOf(tab)?.role" class="role">{{ dock.sessionOf(tab)?.role }}</span>
                {{ dock.sessionOf(tab)?.name ?? tab.key }}
              </template>
            </button>
            <UiIconButton
              class="close"
              icon-size="xs"
              :icon="X"
              :label="`Close ${dock.labelOf(tab)}`"
              size="xs"
              tip="Close"
              @click="dock.close(tab)"
            />
          </div>
          <UiIconButton
            v-if="isTerminal"
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
        <RunFailure v-if="shown && failing.length" :lines="failing" :tab="shown" />
        <div class="screens">
          <DockScreen v-for="tab in dock.tabs" :key="tab.id" :is-shown="tab.id === shown?.id" :tab="tab" />
          <UiStateMessage v-if="!shown" class="empty" align="center">
            <template v-if="!isTerminal">Nothing has run in {{ front.name }}</template>
            <template v-else>{{ isOpening ? `Opening a shell in ${front.name}…` : `No shells in ${front.name}` }}</template>
          </UiStateMessage>
        </div>
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
  @apply relative inline-flex h-7 flex-none items-center rounded-lg border border-transparent typo-mono-meta text-muted transition-colors duration-(--duration-fast) ease-out;
}

.tab:hover {
  @apply bg-sunken text-fg;
}

.tab[data-selected="true"] {
  @apply border-border bg-sunken text-fg;
}

.tab[data-dragging="true"] {
  @apply opacity-40;
}

.tab[data-drop="before"]::before,
.tab[data-drop="after"]::after {
  content: "";
  @apply absolute inset-y-1 w-0.5 rounded-full bg-primary;
}

.tab[data-drop="before"]::before {
  @apply left-0;
}

.tab[data-drop="after"]::after {
  @apply right-0;
}

.label {
  @apply inline-flex h-full cursor-pointer items-center gap-1.5 rounded-lg bg-transparent pr-1 pl-2.5;
}

.label:focus-visible {
  @apply focus-ring;
}

.close {
  @apply opacity-0;
}

.tab:hover .close,
.tab:focus-within .close,
.tab[data-selected="true"] .close {
  @apply opacity-100;
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
  @apply flex min-h-0 flex-1 flex-col bg-raised;
}

.screens {
  @apply relative min-h-0 flex-1;
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
