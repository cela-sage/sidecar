<script lang="ts" setup>
import type { Part } from "~~/shared/utils/parts";

const { parts } = defineProps<{ parts: Part[] }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <section class="fold" aria-label="The workstream" data-region="task-fold">
    <span class="label mono-meta">The workstream</span>
    <button
      v-for="(part, i) in parts"
      :key="part.name"
      class="part plain-button focusable"
      type="button"
      aria-expanded="false"
      @click="emit('open')"
    >
      <span class="n mono-meta">{{ String(i + 1).padStart(2, "0") }}</span>
      <span class="name">{{ part.name }}</span>
      <span class="lead">{{ part.lead }}</span>
    </button>
  </section>
</template>

<style scoped>
.fold {
  @apply flex flex-col gap-0.5;
}

.label {
  @apply pb-1 text-subtle;
}

.part {
  @apply -mx-2 flex items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.75 text-left text-fg transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .part:hover {
    @apply bg-sunken;
  }
}

.n {
  @apply flex-none text-subtle normal-case;
}

.name {
  @apply w-20.5 flex-none typo-body font-bold;
}

.lead {
  @apply min-w-0 flex-1 truncate typo-body text-muted;
}
</style>
