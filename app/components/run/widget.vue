<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { ChevronDown, Play, Plus, RotateCcw, Square } from "@lucide/vue";
import type { RunConfig, RunGroup } from "~~/shared/types/runs";
import type { DockProject } from "~/stores/dock";

const { project } = defineProps<{ project: DockProject }>();

const runs = $runs();
const door = $door();
const filter = ref("");
const field = useTemplateRef<{ $el: HTMLInputElement }>("field");

watch(field, (now) => now?.$el.focus());

const config = computed(() => runs.pickedOf(project.key));
const tab = computed(() => (config.value ? runs.tabOf(project.key, config.value.id) : undefined));
const isRunning = computed(() => tab.value?.status === "running");

const labelOf = (group: RunGroup): string =>
  group.source === "assistant" ? "Written by the Assistant" : `${group.repo} · ${group.source}`;

const shown = computed(() => {
  const words = filter.value.trim().toLowerCase();
  return (runs.groups[project.key] ?? [])
    .map((group) => ({
      ...group,
      configs: group.configs.filter(
        (one) => !words || `${group.repo ?? ""} ${one.name} ${one.shown}`.toLowerCase().includes(words),
      ),
    }))
    .filter((group) => group.configs.length);
});

watch(
  () => project.key,
  (key) => void runs.load(key),
  { immediate: true },
);

const opening = (isOpen: boolean): void => {
  if (isOpen) return;
  filter.value = "";
  void runs.load(project.key);
};

const run = (one: RunConfig | undefined = config.value): void => {
  if (one) void runs.start(project.key, one);
};

const stop = (): void => {
  if (tab.value) void runs.stop(tab.value);
};

const opened = (close: () => void, one: RunConfig): void => {
  close();
  run(one);
};

const firstShown = (close: () => void): void => {
  const one = shown.value[0]?.configs[0];
  if (one) opened(close, one);
};

const ask = (close: () => void): void => {
  close();
  door.compose(`Add a run configuration to ${project.name} that `);
};

// ⌃R stays the shell's history search inside the terminal.
const isInTerminal = (): boolean => !!document.activeElement?.closest(".xterm");

useShortcuts({
  "Ctrl+R": {
    run: () => run(),
    when: () => !!config.value && !isRunning.value && !isInTerminal() && !areBrowserKeysLive(),
  },
  "Mod+R": { run: () => run(), when: () => isRunning.value && !areBrowserKeysLive() },
  "Mod+F2": { run: stop, when: isRunning },
});
</script>

<template>
  <div class="run" role="group" data-region="run" :aria-label="`Run configurations of ${project.name}`">
    <UiPopover :estimated-height="420" placement="bottom" width="w-93">
      <template #trigger="{ open }">
        <button
          class="pick"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="open"
          :data-open="open"
          :data-tip="`Run configurations of ${project.name}`"
          @click="opening(open)"
        >
          <RunStatusMark :status="tab?.status" />
          <span class="name">{{ config?.name ?? "Run" }}</span>
          <span v-if="config" class="command">{{ config.shown }}</span>
          <UiIcon class="chevron" :icon="ChevronDown" size="xs" />
        </button>
      </template>

      <template #default="{ close }">
        <div class="menu" role="menu" aria-label="Run configurations" data-region="run-menu">
          <div class="head">
            <span class="title">Run configurations</span>
            <span class="where mono-meta">
              <OrgAvatar v-if="project.project && project.tint" :project="project.project" :tint="project.tint" />
              {{ project.name }}
            </span>
          </div>
          <UiTextInput
            ref="field"
            v-model="filter"
            aria-label="Filter run configurations"
            autocomplete="off"
            class="filter"
            placeholder="Filter"
            spellcheck="false"
            type="search"
            @keydown.enter.prevent="firstShown(close)"
          />
          <div class="groups">
            <div v-for="group in shown" :key="`${group.repo}:${group.source}`" class="group">
              <p class="eyebrow mono-meta">{{ labelOf(group) }}</p>
              <UiMenuItem
                v-for="one in group.configs"
                :key="one.id"
                :aria-pressed="one.id === config?.id"
                :data-tip="`Run ${one.name}`"
                role="menuitem"
                @click="opened(close, one)"
              >
                <UiIcon class="play-mark" :icon="Play" size="xs" />
                <span class="row-name">{{ one.name }}</span>
                <span class="row-command">{{ one.shown }}</span>
              </UiMenuItem>
            </div>
            <UiStateMessage v-if="!shown.length" align="center" class="none">
              {{ filter ? `Nothing in ${project.name} matches ${filter}` : `${project.name} has nothing to run yet` }}
            </UiStateMessage>
          </div>
          <span class="divider" aria-hidden="true" />
          <UiMenuItem
            :data-tip="`The Assistant writes one for ${project.name} and adds it here`"
            :icon="Plus"
            role="menuitem"
            @click="ask(close)"
          >
            Ask the Assistant for one
          </UiMenuItem>
        </div>
      </template>
    </UiPopover>

    <UiIconButton
      v-if="!isRunning"
      class="go"
      :disabled="!config"
      :icon="Play"
      label="Run"
      size="xs"
      :tip="config ? `Run ${config.name} · ⌃R` : 'Nothing to run yet'"
      @click="run()"
    />
    <template v-else>
      <UiIconButton :icon="RotateCcw" label="Restart" size="xs" :tip="`Restart ${config?.name} · ⌘R`" @click="run()" />
      <UiIconButton class="halt" :icon="Square" label="Stop" size="xs" :tip="`Stop ${config?.name} · ⌘F2`" @click="stop" />
    </template>
  </div>
</template>

<style scoped>
.run {
  @apply flex h-8.5 flex-none items-center gap-0.5 rounded-full border border-border bg-sunken p-0.5;
}

.pick {
  @apply inline-flex h-7 max-w-64 min-w-0 cursor-pointer items-center gap-1.75 rounded-full border-0 bg-raised px-2.5 text-fg shadow-sm;
}

.pick:focus-visible {
  @apply focus-ring;
}

.name {
  @apply flex-none typo-caption font-semibold whitespace-nowrap;
}

.command {
  @apply min-w-0 truncate typo-mono-pico text-muted;
}

.chevron {
  @apply flex-none text-muted;
}

.go {
  @apply text-success;
}

.halt {
  @apply text-error;
}

.menu {
  @apply flex flex-col gap-0.5 p-1;
}

.head {
  @apply flex items-center gap-2 px-2 pt-2 pb-1;
}

.title {
  @apply typo-caption-strong font-bold;
}

.where {
  @apply inline-flex items-center gap-1.25 text-muted;
}

.filter {
  @apply mx-1 my-1;
}

.groups {
  @apply flex max-h-90 flex-col gap-px overflow-y-auto;
}

.group {
  @apply flex flex-col gap-px;
}

.eyebrow {
  @apply m-0 px-2 pt-2 pb-0.75 tracking-widest text-subtle uppercase;
}

.play-mark {
  @apply flex-none text-success;
}

.row-name {
  @apply flex-none typo-caption-strong text-fg;
}

.row-command {
  @apply min-w-0 flex-1 truncate typo-mono-pico text-subtle;
}

.none {
  @apply py-4;
}

.divider {
  @apply mx-1.5 my-1 h-px bg-border;
}
</style>
