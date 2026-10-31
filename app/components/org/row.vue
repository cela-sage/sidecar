<script lang="ts" setup>
import type { AgentFace } from "~~/shared/types/session";
import type { Role } from "~~/shared/types/task";
import type { Mark } from "~/utils/org";

const {
  agent,
  conversation,
  depth = 0,
  doing,
  id,
  isFront = false,
  isSelected = false,
  isTask = false,
  mark,
  name,
  role,
  tip,
} = defineProps<{
  agent?: AgentFace;
  conversation?: string;
  depth?: number;
  doing?: string;
  id?: string;
  isFront?: boolean;
  isSelected?: boolean;
  isTask?: boolean;
  mark: Mark;
  name: string;
  role?: Role;
  tip?: string;
}>();
const emit = defineEmits<{ open: [] }>();

const conversationMenu = $conversationMenu();
const isLit = computed(() => !!conversation && conversationMenu.lit === conversation);
const hint = computed(() => {
  const who = agent ? `${agent.name} · ${name}${mark === "killed" ? " · killed" : ""}` : (tip ?? name);
  return doing ? `${who} · ${doing}` : who;
});
</script>

<template>
  <div
    class="row"
    role="treeitem"
    :aria-selected="isSelected"
    :data-conversation="conversation"
    :data-depth="depth"
    :data-front="isFront"
    :data-mark="mark"
    :data-lit="isLit"
    :data-selected="isSelected"
    :data-task="isTask"
  >
    <OrgGuides :depth="depth" />
    <span v-if="isFront" class="bar" aria-hidden="true" />
    <button class="open plain-button focusable" type="button" :data-tip="hint" @click="emit('open')">
      <OrgMark :mark="mark" />
      <span v-if="role" class="role">{{ role }}</span>
      <OrgAgentIcon v-if="agent" :icon="agent.icon" :is-killed="mark === 'killed'" :size="16" />
      <span class="name">{{ agent?.name ?? name }}</span>
      <slot />
      <span v-if="id" class="id">{{ id }}</span>
    </button>
    <slot name="after" />
  </div>
</template>

<style scoped>
.row {
  @apply relative isolate box-border flex min-h-7 items-center gap-1 rounded-lg border border-transparent pr-0.5 pl-1.5;
}

.row::before {
  @apply pointer-events-none absolute inset-y-0 right-0 left-0 -z-1 rounded-lg border border-transparent content-[''];
}

.row[data-depth="1"] {
  @apply pl-7;
}

.row[data-depth="2"] {
  @apply pl-14;
}

.row[data-depth="3"] {
  @apply pl-21;
}

.row[data-depth="4"] {
  @apply pl-28;
}

.row[data-depth="1"]::before {
  @apply left-5;
}

.row[data-depth="2"]::before {
  @apply left-12;
}

.row[data-depth="3"]::before {
  @apply left-19;
}

.row[data-depth="4"]::before {
  @apply left-26;
}

.row[data-selected="true"]::before {
  @apply border-border-strong bg-sunken;
}

.row[data-lit="true"]::before {
  @apply border-primary bg-primary-soft transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .row:not([data-selected="true"]):hover::before {
    @apply bg-sunken;
  }
}

.bar {
  @apply absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-xs bg-fg;
}

.row[data-depth="1"] .bar {
  @apply left-5.5;
}

.row[data-depth="2"] .bar {
  @apply left-12.5;
}

.row[data-depth="3"] .bar {
  @apply left-19.5;
}

.row[data-depth="4"] .bar {
  @apply left-26.5;
}

.open {
  @apply flex h-6.5 min-w-0 flex-1 items-center gap-1.75 border-0 bg-transparent px-1 text-left text-fg;
}

.role {
  @apply flex-none rounded-sm bg-sunken px-1.25 py-px typo-mono-pico font-semibold tracking-wide text-muted;
}

.name {
  @apply min-w-0 flex-1 truncate typo-caption font-medium;
}

.row[data-task="true"] .name {
  @apply font-semibold;
}

.row[data-front="true"] .name {
  @apply font-bold;
}

.row[data-mark="killed"] .name,
.row[data-mark="archived"] .name {
  @apply text-muted;
}

.row[data-mark="raised"] .name {
  @apply text-error;
}

.id {
  @apply flex-none typo-mono-micro text-subtle;
}
</style>
