<script lang="ts" setup>
import type { TimelineRow } from "~/utils/timeline";

const { row, isPicked = false } = defineProps<{ row: TimelineRow; isPicked?: boolean }>();
const emit = defineEmits<{ pick: [] }>();

const at = computed(() => {
  const when = new Date(row.at);
  return when.toDateString() === new Date().toDateString()
    ? when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : when.toLocaleDateString([], { day: "numeric", month: "short" });
});
</script>

<template>
  <button
    class="row plain-button focusable"
    type="button"
    data-region="task-history-row"
    :aria-current="isPicked"
    :data-picked="isPicked"
    :data-you="row.who === 'YOU'"
    @click="emit('pick')"
  >
    <span class="at mono-meta">{{ at }}</span>
    <span class="who" :data-you="row.who === 'YOU'">{{ row.who }}</span>
    <span class="body">
      <span class="text"
        ><strong v-if="row.lead">{{ row.lead }}</strong>{{ row.text }}</span
      >
      <span v-if="row.chips.length" class="chips">
        <span v-for="chip in row.chips" :key="chip" class="chip mono-meta">{{ chip }}</span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.row {
  @apply box-border grid w-full grid-cols-[--spacing(9)_--spacing(6)_minmax(0,1fr)] items-start gap-x-2 rounded-field border border-transparent px-2 py-2.25 text-left text-fg transition-colors duration-(--duration-fast) ease-out;
}

.row[data-picked="true"] {
  @apply border-border-strong bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .row:not([data-picked="true"]):hover {
    @apply bg-sunken;
  }
}

.at {
  @apply pt-1.25 text-muted normal-case;
}

.row[data-picked="true"] .at {
  @apply text-fg;
}

.who {
  @apply box-border inline-flex size-6 items-center justify-center rounded-full bg-primary-soft typo-mono-pico font-semibold text-primary-deep;
}

.who[data-you="true"] {
  @apply border border-border-strong bg-raised text-fg;
}

.body {
  @apply flex min-w-0 flex-col gap-1.25;
}

.text {
  @apply line-clamp-3 typo-caption leading-snug text-muted wrap-anywhere;
}

.row[data-you="true"] .text,
.row[data-picked="true"] .text {
  @apply text-fg;
}

.row[data-picked="true"] .text {
  @apply line-clamp-none whitespace-pre-line;
}

.chips {
  @apply flex flex-wrap gap-1.25;
}

.chip {
  @apply rounded-full bg-sunken px-1.75 py-px tracking-normal text-muted normal-case;
}

.row[data-picked="true"] .chip {
  @apply bg-raised;
}
</style>
