<script lang="ts" setup>
import { BellRing, LocateFixed, Pin } from "@lucide/vue";
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
      <ChromeAction data-region="follow-mode" :icon="now.icon" :is-pressed="open" shape="island" :tip="now.label" />
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
