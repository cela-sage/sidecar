<script lang="ts" setup>
import type { SessionCommand } from "~~/shared/types/command";

const { cursor, rows } = defineProps<{ cursor: number; rows: SessionCommand[] }>();
const emit = defineEmits<{ pick: [row: SessionCommand]; point: [at: number] }>();
</script>

<template>
  <div class="commands" role="listbox" aria-label="Commands and skills" data-region="conversation-commands">
    <button
      v-for="(row, at) in rows"
      :key="row.name"
      class="row plain-button focusable"
      :aria-selected="at === cursor"
      role="option"
      type="button"
      @mousedown.prevent
      @mousemove="emit('point', at)"
      @click="emit('pick', row)"
    >
      <span class="name">/{{ row.name }}</span>
      <span class="about">{{ row.description }}</span>
      <span v-if="row.screen === 'always'" class="screen mono-meta">terminal</span>
    </button>
  </div>
</template>

<style scoped>
.commands {
  @apply flex max-h-60 flex-col gap-px overflow-y-auto rounded-box bg-raised p-1.5 shadow-lg ring-1 ring-border-strong;
}

.row {
  @apply flex h-8 flex-none items-baseline gap-2.5 rounded-lg border-0 bg-transparent px-2 text-left;
}

.row[aria-selected="true"] {
  @apply bg-primary-soft;
}

.name {
  @apply flex-none font-mono typo-mono-meta font-semibold text-fg;
}

.about {
  @apply min-w-0 flex-1 truncate typo-caption text-muted;
}

.screen {
  @apply flex-none text-subtle normal-case;
}
</style>
