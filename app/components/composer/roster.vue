<script lang="ts" setup>
import { Users } from "@lucide/vue";
import type { ChannelPick } from "~/utils/channel-picker";

const { cursor, rows } = defineProps<{ cursor: number; rows: ChannelPick[] }>();
const emit = defineEmits<{ pick: [row: ChannelPick]; point: [at: number] }>();

const HEADS: Record<ChannelPick["section"], { title: string; sub: string }> = {
  in: { title: "In this channel", sub: "@ notifies and interrupts its turn" },
  out: { title: "Outside the channel", sub: "only you and the Assistant · one read each" },
};

const startsSection = (at: number): boolean => at === 0 || rows[at - 1]?.section !== rows[at]?.section;
</script>

<template>
  <div class="roster" role="listbox" aria-label="Mention" data-region="channel-mentions">
    <p v-if="!rows.length" class="none">Nobody in the channel or the tree matches that.</p>
    <template v-for="(row, at) in rows" :key="row.key">
      <div v-if="startsSection(at)" class="head">
        <span class="head-title mono-meta">{{ HEADS[row.section].title }}</span>
        <span class="head-sub">{{ HEADS[row.section].sub }}</span>
      </div>
      <div
        class="option"
        role="option"
        :aria-selected="at === cursor"
        @mousedown.prevent
        @mousemove="emit('point', at)"
        @click="emit('pick', row)"
      >
        <ChannelFace v-if="row.speaker" :size="20" :speaker="row.speaker" />
        <span v-else class="everyone" aria-hidden="true"><UiIcon :icon="Users" size="xs" /></span>
        <span class="name">{{ row.name }}</span>
        <span v-if="row.speaker?.role" class="role">{{ row.speaker.role }}</span>
        <span class="work">{{ row.work }}</span>
        <span class="note" :data-urgent="row.isUrgent">{{ row.note }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.roster {
  @apply flex max-h-80 max-w-115 flex-col gap-0.5 overflow-y-auto rounded-xl bg-raised p-1 shadow-lg ring-1 ring-border;
}

.head {
  @apply flex items-baseline gap-2 px-2 pt-2 pb-1;
}

.head-title {
  @apply text-subtle;
}

.head-sub {
  @apply typo-caption text-muted;
}

.option {
  @apply flex h-8.5 flex-none cursor-pointer items-center gap-2.25 rounded-lg px-2;
}

.option[aria-selected="true"] {
  @apply bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .option:hover {
    @apply bg-primary-soft;
  }
}

.everyone {
  @apply inline-flex size-5 flex-none items-center justify-center rounded-md bg-sunken text-muted;
}

.name {
  @apply flex-none typo-caption-strong font-bold;
}

.role {
  @apply flex-none rounded-sm bg-sunken px-1.25 py-px typo-mono-pico font-semibold tracking-wide text-muted;
}

.work {
  @apply min-w-0 flex-1 truncate typo-caption text-muted;
}

.note {
  @apply flex-none typo-mono-micro font-medium text-muted;
}

.note[data-urgent="true"] {
  @apply text-error;
}

.none {
  @apply m-0 p-2 typo-caption text-muted;
}
</style>
