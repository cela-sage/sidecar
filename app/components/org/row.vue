<script lang="ts" setup>
import { Terminal } from "@lucide/vue";
import type { Role } from "~~/shared/types/task";
import type { Mark } from "~/utils/org";

const {
  attach,
  attachTip = "Attach in your terminal",
  depth = 0,
  id,
  isFront = false,
  isSelected = false,
  isTask = false,
  mark,
  name,
  role,
  tip,
} = defineProps<{
  attach?: string;
  attachTip?: string;
  depth?: 0 | 1 | 2;
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

const terminal = $terminal();
const isHeld = computed(() => !!attach && terminal.state.held?.key === attach);
</script>

<template>
  <div
    class="row"
    role="treeitem"
    :aria-selected="isSelected"
    :data-depth="depth"
    :data-done="mark === 'done'"
    :data-front="isFront"
    :data-selected="isSelected"
    :data-task="isTask"
  >
    <span v-if="depth >= 1" class="guide" aria-hidden="true" />
    <span v-if="depth >= 2" class="guide deep" aria-hidden="true" />
    <span v-if="isFront" class="bar" aria-hidden="true" />
    <button class="open plain-button focusable" type="button" :data-tip="tip ?? name" @click="emit('open')">
      <OrgMark :mark="mark" />
      <span v-if="role" class="role">{{ role }}</span>
      <span class="name">{{ name }}</span>
      <span v-if="id" class="id">{{ id }}</span>
    </button>
    <button
      v-if="attach"
      class="attach plain-button focusable"
      type="button"
      :aria-label="isHeld ? 'In your terminal' : 'Attach'"
      :aria-pressed="isHeld"
      :data-tip="isHeld ? 'Your terminal holds this one' : attachTip"
      :disabled="terminal.switching === attach"
      @click.stop="!isHeld && terminal.attach(attach)"
    >
      <UiIcon :icon="Terminal" size="xs" />
    </button>
  </div>
</template>

<style scoped>
.row {
  @apply relative box-border flex min-h-7 items-center gap-1 rounded-lg border border-transparent pr-0.5 pl-1.5;
}

.row[data-depth="1"] {
  @apply pl-7;
}

.row[data-depth="2"] {
  @apply pl-14;
}

.row[data-selected="true"] {
  @apply border-border-strong bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .row:not([data-selected="true"]):hover {
    @apply bg-sunken;
  }
}

.guide {
  @apply absolute -top-0.5 -bottom-px left-2.25 w-px origin-left scale-x-50 bg-border;
}

.guide.deep {
  @apply left-10;
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

.row[data-done="true"] .name {
  @apply text-muted;
}

.id {
  @apply flex-none typo-mono-micro text-subtle;
}

.attach {
  @apply inline-flex size-6 flex-none items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-subtle transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .attach:hover {
    @apply border-border-strong text-fg;
  }
}

.attach[aria-pressed="true"] {
  @apply cursor-default border-border-strong bg-sunken text-fg;
}
</style>
