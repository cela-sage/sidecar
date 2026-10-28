<script lang="ts" setup>
import type { Question } from "~~/shared/types/question";

const { question, picked, isAnswering } = defineProps<{
  question: Question;
  picked?: string;
  isAnswering?: boolean;
}>();
const emit = defineEmits<{ pick: [answer: string] }>();
const chosen = ref<string[]>([]);

const isOn = (label: string): boolean => (question.multi ? chosen.value.includes(label) : picked === label);

const press = (label: string): void => {
  if (!question.multi) return emit("pick", label);
  chosen.value = isOn(label) ? chosen.value.filter((one) => one !== label) : [...chosen.value, label];
};

const send = (): void => {
  const labels = question.options.map((one) => one.label).filter((label) => chosen.value.includes(label));
  emit("pick", labels.join(", "));
};
</script>

<template>
  <div class="question">
    <span class="header mono-meta">
      <span v-if="question.header">{{ question.header }}</span>
      <span>{{ question.multi ? "pick any" : "pick one" }}</span>
    </span>
    <p class="text">{{ question.question }}</p>
    <div :aria-label="question.question" class="options" role="group">
      <button
        v-for="option in question.options"
        :key="option.label"
        :aria-pressed="isOn(option.label)"
        class="option plain-button focusable"
        :disabled="isAnswering"
        type="button"
        @click="press(option.label)"
      >
        <span class="label">{{ option.label }}</span>
        <span v-if="option.description" class="description">{{ option.description }}</span>
      </button>
    </div>
    <UiButton
      v-if="question.multi"
      class="send"
      :disabled="isAnswering || !chosen.length"
      size="xs"
      variant="primary"
      @click="send"
    >
      Send
    </UiButton>
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
  @apply flex flex-col overflow-hidden rounded-xl border border-border;
}

.option {
  @apply flex cursor-pointer flex-col gap-px border-t border-t-border px-2.5 py-1.5 text-left first:border-t-0 hover:bg-sunken disabled:cursor-default disabled:opacity-60;

  &[aria-pressed="true"] {
    @apply bg-primary-soft;
  }
}

.label {
  @apply typo-caption-strong;
}

.description {
  @apply typo-caption text-pretty text-muted;
}

.send {
  @apply self-start;
}
</style>
