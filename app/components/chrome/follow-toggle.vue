<script lang="ts" setup>
import { BellRing, ChevronDown, LocateFixed, Pin, Terminal } from "@lucide/vue";
import type { Component } from "vue";
import { FOLLOW_MODES, type FollowMode } from "~/stores/follow";

interface ModeRow {
  hint: string;
  icon: Component;
  label: string;
}

const ROWS: Record<FollowMode, ModeRow> = {
  ask: { hint: "A card asks first, and pressing it moves there", icon: BellRing, label: "Ask to switch" },
  auto: { hint: "Moves to the conversation you type in or pick in Terminal", icon: LocateFixed, label: "Auto switch" },
  manual: { hint: "Moves only when you pick a conversation or run /sidecar", icon: Pin, label: "Manual switch" },
};

const follow = $follow();
const now = computed(() => ROWS[follow.mode] ?? ROWS.ask);

function pick(mode: FollowMode, close: () => void): void {
  follow.mode = mode;
  close();
}
</script>

<template>
  <UiPopover :estimated-height="230" placement="bottom" width="w-76">
    <template #trigger="{ open }">
      <button
        class="trigger plain-button focusable"
        aria-haspopup="menu"
        data-region="follow-mode"
        data-tip="What the sidecar does when your terminal moves to another conversation"
        type="button"
        :aria-expanded="open"
      >
        <UiIcon :icon="Terminal" size="xs" />
        <span class="name">Follow terminal</span>
        <span class="mode mono-meta">{{ now.label }}</span>
        <UiIcon class="chevron" :icon="ChevronDown" size="xs" />
      </button>
    </template>

    <template #default="{ close }">
      <div class="menu" data-region="follow-menu" role="group" aria-label="Switching conversations">
        <p class="head mono-meta">When you move to another conversation</p>
        <UiMenuItem
          v-for="mode in FOLLOW_MODES"
          :key="mode"
          :aria-pressed="follow.mode === mode"
          :icon="ROWS[mode].icon"
          @click="pick(mode, close)"
        >
          <span class="what">
            <span class="label">{{ ROWS[mode].label }}</span>
            <span class="hint">{{ ROWS[mode].hint }}</span>
          </span>
        </UiMenuItem>
      </div>
    </template>
  </UiPopover>
</template>

<style scoped>
.trigger {
  @apply inline-flex h-7.5 min-w-0 items-center gap-1.75 rounded-full border-0 bg-transparent px-2 text-fg transition-colors duration-(--duration-fast) ease-out;
}

.trigger[aria-expanded="true"] {
  @apply bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .trigger:hover {
    @apply bg-sunken;
  }
}

.name {
  @apply typo-caption font-bold whitespace-nowrap;
}

.mode {
  @apply truncate text-muted normal-case;
}

.chevron {
  @apply flex-none text-muted;
}

.menu {
  @apply flex flex-col gap-0.5 p-1.5;
}

.head {
  @apply m-0 px-2 pt-1 pb-1.5 text-subtle;
}

.what {
  @apply flex min-w-0 flex-col gap-0.5;
}

.label {
  @apply typo-body-strong text-fg;
}

.hint {
  @apply typo-meta text-muted;
}
</style>
