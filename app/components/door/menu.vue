<script lang="ts" setup>
import { Plus } from "@lucide/vue";
import type { LiveSession } from "~~/shared/types/session";
import { Titles } from "~~/shared/utils/titles";
import type { DoorTarget } from "~/stores/door";
import type { Mark } from "~/utils/org";

const emit = defineEmits<{ pick: [target: DoorTarget] }>();

const door = $door();
const busy = $busy();
const seen = $seen();

// The turn bus, as the tree reads it, since a polled "working" stays on after the turn ends.
const markOf = (session: LiveSession): Mark => {
  if (session.life === "killed") return "killed";
  const bus = busy.keys[session.key];
  if (bus?.asking) return "waits";
  if (bus?.doing) return "working";
  return seen.keys[session.key] ? "unseen" : "completed";
};

const nameAfterRole = (title: string): string => {
  const parsed = Titles.parse(title);
  const after = parsed?.role ? parsed.words.slice(parsed.words.indexOf(parsed.role) + 1) : [];
  return after.join(" ") || title;
};

const rows = computed(() =>
  door.assistants.map((session) => ({
    key: session.key,
    title: nameOf(session),
    name: nameAfterRole(nameOf(session)),
    mark: markOf(session),
    isOn: door.mode === "assistant" && door.key === session.key,
  })),
);
</script>

<template>
  <div class="menu" role="menu" aria-label="Who to ask" data-region="door-menu">
    <button
      v-for="row in rows"
      :key="row.key"
      class="item plain-button focusable"
      role="menuitemradio"
      type="button"
      :aria-checked="row.isOn"
      :data-on="row.isOn"
      :data-tip="row.title"
      @click="emit('pick', { kind: 'assistant', key: row.key })"
    >
      <OrgMark :mark="row.mark" />
      <span class="name">{{ row.name }}</span>
      <span class="id">{{ row.key }}</span>
    </button>
    <div class="rule" aria-hidden="true" />
    <button
      class="item plain-button focusable"
      data-region="door-new-assistant"
      data-tip="Starts a new assistant conversation with your next message"
      role="menuitemradio"
      type="button"
      :aria-checked="door.mode === 'new'"
      :data-on="door.mode === 'new'"
      @click="emit('pick', { kind: 'new' })"
    >
      <UiIcon class="glyph" :icon="Plus" size="xs" />
      <span class="name">New assistant</span>
    </button>
  </div>
</template>

<style scoped>
.menu {
  @apply flex w-75 flex-col gap-0.5 rounded-xl bg-raised p-1 shadow-lg ring-1 ring-border;
}

.item {
  @apply flex h-8.5 items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-left text-fg transition-colors duration-(--duration-fast) ease-out;
}

.item[data-on="true"] {
  @apply bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .item:hover {
    @apply bg-primary-soft;
  }
}

.glyph {
  @apply flex-none text-muted;
}

.name {
  @apply min-w-0 flex-1 truncate typo-caption font-medium;
}

.item[data-on="true"] .name {
  @apply font-bold;
}

.id {
  @apply max-w-30 flex-none truncate typo-mono-micro text-subtle;
}

.rule {
  @apply mx-1.5 my-0.5 h-px bg-border;
}
</style>
