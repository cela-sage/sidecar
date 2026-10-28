<script lang="ts" setup>
import type { Question } from "~~/shared/types/question";

const { question } = defineProps<{ question: Question }>();
</script>

<template>
  <div class="question">
    <span class="header mono-meta">
      <span v-if="question.header">{{ question.header }}</span>
      <span>{{ question.multi ? "pick any" : "pick one" }}</span>
    </span>
    <p class="text">{{ question.question }}</p>
    <ul :aria-label="question.question" class="options">
      <li v-for="option in question.options" :key="option.label" class="option">
        <span class="label">{{ option.label }}</span>
        <span v-if="option.description" class="description">{{ option.description }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.question {
  @apply flex flex-col gap-2;
}

.header {
  @apply flex items-center gap-2 text-muted;
}

.text {
  @apply m-0 typo-body leading-normal text-pretty;
}

.options {
  @apply m-0 flex list-none flex-col overflow-hidden rounded-xl border border-border p-0;
}

.option {
  @apply flex flex-col gap-px border-t border-t-border px-2.5 py-1.5 first:border-t-0;
}

.label {
  @apply typo-caption-strong;
}

.description {
  @apply typo-caption text-pretty text-muted;
}
</style>
