<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { Check, ChevronDown, CircleDot, MessageSquare, MousePointer2, Plus, Terminal } from "@lucide/vue";
import type { Component } from "vue";
import { FOLLOW_MODES, type FollowMode } from "~/stores/follow";

interface ModeRow {
  hint: string;
  icon: Component;
  label: string;
}

const ROWS: Record<FollowMode, ModeRow> = {
  auto: { hint: "Moves to the conversation you type in or pick in Terminal", icon: CircleDot, label: "Auto switch" },
  ask: { hint: "A card asks first, and pressing it moves there", icon: MessageSquare, label: "Ask to switch" },
  manual: {
    hint: "Moves only when you pick a conversation or run /sidecar",
    icon: MousePointer2,
    label: "Manual switch",
  },
};

const follow = $follow();
const desk = $desk();
const tree = useOrgTree();

const now = computed(() => ROWS[follow.mode] ?? ROWS.ask);
const place = computed(() => (follow.offer?.key ? Org.placeOf(tree.value, follow.offer.key) : undefined));
const where = computed(() => {
  const group = place.value?.group;
  if (!group) return undefined;
  const slug = place.value?.row.slug;
  const task = slug ? [...group.tasks, ...group.done].find((one) => one.meta.slug === slug) : undefined;
  return task ? `${group.project.name} · ${task.meta.title}` : group.project.name;
});

function pick(mode: FollowMode, close: () => void): void {
  follow.mode = mode;
  close();
}

// Escape fires even while typing, and in the terminal or a prompt it belongs to what you type in.
const isTyping = (): boolean => !!document.activeElement?.closest("input, textarea, [contenteditable='true']");

useShortcuts(
  {
    Enter: () => follow.accept(),
    Escape: () => follow.decline(),
  },
  { when: () => !!follow.offer && !isTyping() },
);
</script>

<template>
  <div class="follow" data-region="org-header">
    <header class="bar">
      <span class="lights" aria-hidden="true" />
      <UiPopover :estimated-height="250" placement="bottom" width="w-79">
        <template #trigger="{ open }">
          <button
            class="mode"
            type="button"
            aria-haspopup="menu"
            data-region="follow-mode"
            data-tip="What the sidecar does when your terminal moves to another conversation"
            :aria-expanded="open"
            :data-open="open"
          >
            <UiIcon :icon="Terminal" size="sm" />
            <span class="label">Follow terminal</span>
            <span class="now mono-meta">{{ now.label }}</span>
            <UiIcon class="chevron" :icon="ChevronDown" size="xs" />
          </button>
        </template>

        <template #default="{ close }">
          <div class="menu" data-region="follow-menu" role="menu" aria-label="When your terminal moves">
            <p class="head mono-meta">When your terminal moves</p>
            <UiMenuItem
              v-for="mode in FOLLOW_MODES"
              :key="mode"
              :aria-pressed="follow.mode === mode"
              :icon="ROWS[mode].icon"
              @click="pick(mode, close)"
            >
              <span class="what">
                <span class="name">{{ ROWS[mode].label }}</span>
                <span class="hint">{{ ROWS[mode].hint }}</span>
              </span>
              <UiIcon v-if="follow.mode === mode" class="check" :icon="Check" size="sm" />
            </UiMenuItem>
          </div>
        </template>
      </UiPopover>
      <span class="spacer" />
      <UiIconButton
        aria-label="New task"
        data-region="org-new-task"
        data-tip="New task · {N}"
        :icon="Plus"
        size="md"
        @click="desk.isNaming = true"
      />
      <ChromeThemeToggle shape="inset" />
    </header>

    <div v-if="follow.offer" class="moved">
      <section
        class="card"
        data-region="follow-offer"
        aria-label="Your terminal moved"
        aria-live="polite"
        role="status"
      >
        <span class="eyebrow mono-meta"><UiIcon :icon="Terminal" size="xs" />Your terminal moved</span>
        <span class="who">
          <OrgMark v-if="place" :mark="place.row.mark" />
          <span v-if="place?.row.role" class="role">{{ place.row.role }}</span>
          <span class="name">{{ place?.row.name ?? follow.offer.name ?? follow.offer.key }}</span>
          <span v-if="where" class="where mono-meta">{{ where }}</span>
        </span>
        <span class="actions">
          <UiButton data-tip="Stay here · esc" size="xs" variant="ghost" @click="follow.decline()">Not now</UiButton>
          <UiButton data-tip="Show it here · ↵" size="xs" variant="secondary" @click="follow.accept()">Switch</UiButton>
        </span>
      </section>
    </div>
  </div>
</template>

<style scoped>
.follow {
  @apply relative flex flex-none flex-col;
}

/* The traffic lights' row, so its middle stays where the desktop shell draws them. */
.bar {
  @apply flex h-(--island-row-h) flex-none items-center gap-1 border-b border-b-border px-2;
}

.lights {
  @apply hidden h-3 w-14 flex-none;
}

:global(.shell[data-shell="true"]) .lights {
  @apply block;
}

/* On the desktop shell this row is the title bar: it drags the window, and a double click does what System Settings says. */
:global(.shell[data-shell="true"]:not([data-full="true"])) .bar {
  app-region: drag;
}

:global(.shell[data-shell="true"]) .bar > :not(.spacer, .lights) {
  app-region: no-drag;
}

.mode {
  @apply inline-flex h-7.5 min-w-0 cursor-pointer items-center gap-1.75 rounded-full border-0 bg-transparent px-2 text-fg transition-colors duration-(--duration-fast) ease-out;
}

.mode:hover,
.mode[data-open="true"] {
  @apply bg-sunken;
}

.mode:focus-visible {
  @apply focus-ring;
}

.label {
  @apply typo-caption-strong font-bold whitespace-nowrap;
}

.now {
  @apply truncate text-muted;
}

.chevron {
  @apply flex-none text-muted;
}

.spacer {
  @apply flex-1;
}

.menu {
  @apply flex flex-col gap-0.5 p-1;
}

.head {
  @apply m-0 px-2 pt-1.5 pb-1 text-subtle;
}

.what {
  @apply flex min-w-0 flex-1 flex-col gap-0.5;
}

.name {
  @apply typo-body-strong text-fg;
}

.hint {
  @apply typo-meta text-muted;
}

.check {
  @apply text-fg;
}

.moved {
  @apply px-2 pt-2 pb-0.5;
}

.card {
  @apply flex flex-col gap-2 rounded-box border border-border bg-raised py-2.5 pr-2.5 pl-3 shadow-md;
}

.eyebrow {
  @apply flex items-center gap-1.5 text-subtle uppercase;
}

.who {
  @apply flex min-w-0 items-center gap-1.75;
}

.role {
  @apply flex-none rounded-sm bg-sunken px-1.25 py-px typo-mono-pico font-semibold tracking-wide text-muted;
}

.who .name {
  @apply flex-none typo-caption-strong font-bold;
}

.where {
  @apply min-w-0 flex-1 truncate text-muted normal-case;
}

.actions {
  @apply flex items-center justify-end gap-1.5;
}

@media (prefers-reduced-motion: reduce) {
  .mode {
    @apply transition-none;
  }
}
</style>
