<script lang="ts" setup>
import type { AskedQuestion } from "~/stores/questions";

const { ask } = defineProps<{ ask: AskedQuestion }>();
const questions = $questions();
const terminal = $terminal();
</script>

<template>
  <div class="asks" data-region="question">
    <span class="eyebrow mono-meta"><span class="eyebrow-dot dot" />Waiting on your answer</span>
    <QuestionOptions
      v-for="one in ask.questions"
      :key="one.question"
      :is-answering="ask.isAnswering"
      :picked="ask.picks[one.question]"
      :question="one"
      @pick="(answer) => questions.pick({ ref: ask.ref, question: one.question, answer })"
    />
    <span v-if="ask.isAnswering" class="hint" role="status">Answering it</span>
    <span v-else class="hint">
      {{
        ask.isMissed ? "It didn't reach the question, so answer it in the terminal." : "or answer it in the terminal"
      }}
      <button
        class="link plain-button focusable"
        data-tip="Attach in your terminal"
        type="button"
        @click="terminal.attach(ask.key)"
      >
        Attach
      </button>
    </span>
  </div>
</template>

<style scoped>
.asks {
  @apply flex flex-col gap-2 rounded-xl bg-sunken p-3;
}

.eyebrow {
  @apply flex items-center gap-1.5 font-semibold text-warning;
}

.eyebrow-dot {
  @apply size-1.75 bg-warning;
}

.hint {
  @apply typo-caption text-muted;
}

.link {
  @apply flex-none border-0 bg-transparent px-1 typo-caption font-semibold text-muted underline underline-offset-3;
}
</style>
