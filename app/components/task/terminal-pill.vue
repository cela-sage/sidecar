<script lang="ts" setup>
import { ChevronDown, Copy, Terminal } from "@lucide/vue";
import { onClickOutside } from "@vueuse/core";
import type { LiveSession } from "~~/shared/types/session";
import { Titles } from "~~/shared/utils/titles";
import type { AgentState, TaskLook } from "~/utils/tasks";

interface Line {
  key: string;
  token?: string;
  rest: string;
  state: AgentState;
  look: TaskLook;
}

const COMMAND = "sidecar terminal";
const LOOK: Record<AgentState, TaskLook> = { working: "running", "needs input": "needs", completed: "done" };

const sc = useSidecar();
const chrome = useChrome();
const task = $task();
const terminal = $terminal();
const root = useTemplateRef<HTMLElement>("root");
const isOpen = ref(false);

const slug = computed(() => task.slug ?? "");
const title = computed(
  () => Tasks.of(sc.catalogue.value).find((one) => one.slug === slug.value)?.title || deslug(slug.value),
);
const asking = computed(() => task.asks.filter((thread) => thread.status !== "resolved"));

const lineOf = (key: string, name: string, session?: LiveSession): Line => {
  const parsed = Titles.parse(name);
  const asked = asking.value.some((thread) => thread.ask?.from === name);
  const state: AgentState = asked ? "needs input" : session ? Tasks.agentStateOf(session) : "working";
  return { key, token: parsed?.token, rest: parsed?.rest ?? name, state, look: LOOK[state] };
};

const rows = computed(() =>
  Tasks.railOf(sc.sessions.value, slug.value).map((session) => lineOf(session.key, nameOf(session), session)),
);

const held = computed(() => {
  const at = terminal.state.held;
  if (!at) return undefined;
  const session = sc.sessions.value.find((one) => one.key === at.key);
  return lineOf(at.key, session ? nameOf(session) : (at.name ?? at.key), session);
});

const switchingTo = computed(() => {
  const key = terminal.switching;
  if (!key) return "";
  const session = sc.sessions.value.find((one) => one.key === key);
  const next = lineOf(key, session ? nameOf(session) : key, session).rest;
  return held.value ? `Detaching ${held.value.rest}, attaching ${next}` : `Attaching ${next}`;
});

const tip = computed(() =>
  terminal.state.following
    ? "What your terminal holds. Pick a conversation to switch it"
    : "sidecar terminal isn't running, so the sidecar can't switch your terminal",
);

const copy = async (): Promise<void> => {
  await navigator.clipboard
    .writeText(COMMAND)
    .then(() => chrome.toast("Copied sidecar terminal"))
    .catch(() => chrome.toast("The clipboard refused the copy", "destructive"));
};

watch(
  () => terminal.switching,
  (key) => {
    if (key) isOpen.value = false;
  },
);

onClickOutside(root, () => (isOpen.value = false));
onMounted(() => void terminal.load());
useEvents().on("terminal.changed", ({ data }) => terminal.heard(data));
</script>

<template>
  <div ref="root" class="terminal" data-region="terminal-pill">
    <UiSurface v-island-pop="'top right'" class="pill" pad="none" shape="pill" variant="glass-liquid">
      <div v-if="terminal.switching" class="open" role="status">
        <UiIcon :icon="Terminal" size="xs" />
        <span class="label mono-meta">Terminal</span>
        <TaskDot look="running" />
        <span class="held shimmer">{{ switchingTo }}</span>
      </div>
      <button
        v-else
        class="open plain-button focusable"
        type="button"
        :aria-expanded="isOpen"
        :aria-haspopup="terminal.state.following ? 'menu' : 'dialog'"
        :data-tip="tip"
        @click="isOpen = !isOpen"
      >
        <UiIcon :icon="Terminal" size="xs" />
        <span class="label mono-meta">Terminal</span>
        <template v-if="held">
          <TaskDot :look="held.look" />
          <span class="held"
            ><span v-if="held.token" class="token">[{{ held.token }}]</span> {{ held.rest }}</span
          >
        </template>
        <span v-else class="held" data-quiet="true">{{
          terminal.state.following ? "holds nothing" : "not followed"
        }}</span>
        <UiIcon class="chevron" :icon="ChevronDown" size="xs" />
      </button>
    </UiSurface>

    <UiSurface v-if="isOpen && !terminal.state.following" class="note" pad="none" role="note" variant="raised">
      <span class="line">
        The sidecar switches your terminal through a follower you start once, in the terminal you use for Claude Code.
      </span>
      <span class="command">
        <code>{{ COMMAND }}</code>
        <UiIconButton :icon="Copy" label="Copy" size="sm" @click="copy" />
      </span>
      <span class="until">Until then, Attach copies the claude attach line for that conversation.</span>
    </UiSurface>

    <UiSurface
      v-else-if="isOpen"
      class="menu"
      aria-label="This task's conversations"
      pad="none"
      role="menu"
      variant="raised"
    >
      <div class="menu-head">
        <span class="menu-title">{{ slug ? title : "No task open" }}</span>
        <span class="meta mono-meta">{{ rows.length }} conversations · claude agents</span>
      </div>
      <div class="menu-rows">
        <p v-if="!rows.length" class="empty">
          {{ slug ? "No conversation runs this task yet." : "Open a task to list its conversations here." }}
        </p>
        <div
          v-for="row in rows"
          :key="row.key"
          class="menu-row"
          role="menuitem"
          :data-held="row.key === terminal.state.held?.key"
        >
          <TaskDot :look="row.look" />
          <span class="what">
            <span class="name"
              ><span v-if="row.token" class="token">[{{ row.token }}]</span> {{ row.rest }}</span
            >
            <span class="state mono-meta" :data-look="row.look">{{
              row.key === terminal.state.held?.key ? `${row.state} · in your terminal` : row.state
            }}</span>
          </span>
          <TaskAttach :conversation="row.key" />
        </div>
      </div>
      <p class="menu-foot">
        Every other conversation is on the agents screen, where the left arrow on an empty prompt takes you.
      </p>
    </UiSurface>
  </div>
</template>

<style scoped>
.terminal {
  @apply relative flex-none;
}

.pill {
  @apply island-row max-w-105 px-1;
}

.open {
  @apply flex h-full min-w-0 items-center gap-2 rounded-full border-0 bg-transparent px-2 text-fg;
}

.label {
  @apply flex-none text-muted;
}

.held {
  @apply min-w-0 truncate typo-caption-strong whitespace-nowrap;
}

.held[data-quiet="true"] {
  @apply text-muted;
}

.token {
  @apply text-muted;
}

.chevron {
  @apply flex-none text-muted;
}

.note,
.menu {
  @apply absolute top-12 right-0 z-5 box-border flex origin-top-right flex-col settle shadow-lg;
}

.note {
  @apply w-90 gap-2.5 rounded-2xl px-3.5 py-3;
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

.until {
  @apply typo-caption leading-normal text-pretty text-muted;
}

.menu {
  @apply w-110 overflow-hidden rounded-2xl;
}

.menu-head {
  @apply flex items-center gap-2 px-3.5 pt-2.75 pb-1.5;
}

.menu-title {
  @apply min-w-0 truncate typo-body-strong font-bold;
}

.meta {
  @apply flex-none text-muted normal-case;
}

.menu-rows {
  @apply flex flex-col gap-0.5 px-1.5 pt-0.5 pb-1.5;
}

.empty {
  @apply m-0 px-2 py-2 typo-caption text-muted;
}

.menu-row {
  @apply box-border flex min-h-11 items-center gap-2.25 rounded-field py-1 pr-1.5 pl-2.5;
}

.menu-row[data-held="true"] {
  @apply bg-sunken;
}

.what {
  @apply flex min-w-0 flex-1 flex-col gap-0.5;
}

.name {
  @apply truncate typo-body-strong;
}

.state {
  @apply text-muted;
}

.state[data-look="running"] {
  @apply text-primary;
}

.state[data-look="needs"] {
  @apply text-error;
}

.menu-foot {
  @apply m-0 border-t border-t-border px-3.5 pt-2.25 pb-2.75 typo-caption leading-normal text-pretty text-muted;
}
</style>
