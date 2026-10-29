<script lang="ts" setup>
import type { ToolDiff } from "~~/shared/types/conversation";

type Sign = "+" | "-" | " ";

const SIGNS: Partial<Record<string, Sign>> = { "+": "+", "-": "-" };

const { diff } = defineProps<{ diff: ToolDiff }>();

// Each side counts its own lines, so a removal reads the old file's number and an addition the new one's.
const rows = computed(() =>
  diff.hunks.flatMap((hunk, at) => {
    let old = hunk.oldStart;
    let now = hunk.newStart;
    return hunk.lines.map((line, index) => {
      const sign = SIGNS[line[0] ?? ""] ?? " ";
      const number = sign === "-" ? old++ : now++;
      if (sign === " ") old++;
      return { key: `${at}:${index}`, gap: at > 0 && index === 0, number, sign, text: line.slice(1) };
    });
  }),
);
</script>

<template>
  <div class="hunks" role="table" aria-label="The change">
    <div v-for="row in rows" :key="row.key" class="line" :data-gap="row.gap" :data-sign="row.sign" role="row">
      <span class="number" role="cell">{{ row.number }}</span>
      <span class="sign" role="cell">{{ row.sign === "-" ? "−" : row.sign }}</span>
      <span class="text" role="cell">{{ row.text }}</span>
    </div>
    <p v-if="diff.isClipped" class="more mono-meta">The rest of the change is in Review</p>
  </div>
</template>

<style scoped>
.hunks {
  @apply overflow-x-auto bg-sunken py-2 font-mono typo-mono-meta leading-relaxed;
}

.line {
  @apply flex w-max min-w-full gap-3 px-3.5 whitespace-pre;
}

.line[data-gap="true"] {
  @apply mt-2 border-t border-dashed border-t-border pt-2;
}

.line[data-sign="+"] {
  @apply bg-success-soft;
}

.line[data-sign="-"] {
  @apply bg-error-soft;
}

.number {
  @apply w-6 flex-none text-right text-subtle select-none;
}

.sign {
  @apply w-2.5 flex-none select-none;
}

.line[data-sign="+"] .sign {
  @apply text-success;
}

.line[data-sign="-"] .sign {
  @apply text-error;
}

.text {
  @apply text-fg;
}

.more {
  @apply m-0 px-3.5 pt-2 text-subtle normal-case;
}
</style>
