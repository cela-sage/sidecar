<script lang="ts" setup>
import type { SystemItem } from "~/utils/channel-view";

const { item } = defineProps<{ item: SystemItem }>();
</script>

<template>
  <div class="line" role="note">
    <span v-if="item.who.length" class="stack">
      <ChannelFace v-for="who in item.who" :key="who.key" is-stacked :size="16" :speaker="who" />
    </span>
    <span class="words"
      ><span class="what">{{ item.text }}</span> {{ item.meta }} <time class="at" :datetime="item.at">{{ clockOf(item.at) }}</time></span
    >
  </div>
</template>

<style scoped>
.line {
  @apply flex min-h-7 items-center justify-center gap-2 px-5 py-1;
}

.stack {
  @apply inline-flex flex-none items-center;
}

.stack > :not(:first-child) {
  @apply -ml-1.5;
}

.words {
  @apply min-w-0 truncate typo-caption text-muted;
}

.what {
  @apply font-semibold;
}

.at {
  @apply typo-mono-micro text-subtle;
}
</style>
