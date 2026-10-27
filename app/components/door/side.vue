<script lang="ts" setup>
import type { AskClaudeTurn } from "~/utils/ask-claude";

const sc = useSidecar();
const chrome = useChrome();
const notes = $notes();
const askClaude = $askClaude();
const { sessionState } = useScreen();

const view = computed(() => askClaude.view(sc.sessionKey.value));
const isLast = (turn: AskClaudeTurn): boolean => view.value.turns.at(-1)?.id === turn.id;

// The sidecar's version of the f key in /btw: the side exchange becomes a real turn.
const send = async (turn: AskClaudeTurn): Promise<void> => {
  const key = sc.sessionKey.value;
  if (!key || !turn.answer) return;
  const reply = await notes.deliver({
    key,
    text: `I asked you on the side: ${turn.question}\nYou answered: ${turn.answer}`,
  });
  if (!reply) return;
  if (!reply.delivered) return chrome.toast("The conversation did not take it, try again in a moment.", "warning");
  askClaude.markSent(key, turn.id);
  chrome.toast("Sent to Claude as your next message", "success");
};

const again = (turn: AskClaudeTurn): void => {
  const key = sc.sessionKey.value;
  if (key) void askClaude.ask(key, turn.question);
};
</script>

<template>
  <div class="side" data-region="door-side">
    <div v-for="turn in view.turns" :key="turn.id" class="exchange">
      <p class="you">{{ turn.question }}</p>
      <p v-if="askClaudeState(turn) === 'asking'" class="busy shimmer">
        {{
          sessionState === "busy"
            ? "Reading the whole conversation, the running turn included"
            : "Reading the whole conversation"
        }}
      </p>
      <Prose v-else-if="turn.answer" class="says" :value="turn.answer" />
      <p v-else class="failure" role="alert">{{ turn.failure }}</p>
      <div v-if="isLast(turn) && askClaudeState(turn) !== 'asking'" class="foot">
        <span class="note mono-meta">only you · nothing written to the transcript</span>
        <UiButton
          v-if="askClaudeState(turn) === 'answered'"
          data-tip="Send the question and answer as your next message"
          :disabled="sessionState === 'gone' || turn.isSent || notes.isSending"
          size="xs"
          variant="outline"
          @click="send(turn)"
          >{{ turn.isSent ? "Sent" : "Send to conversation" }}</UiButton
        >
        <UiButton v-else size="xs" variant="outline" @click="again(turn)">Ask again</UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.side {
  @apply flex flex-col gap-4;
}

.exchange {
  @apply flex flex-col gap-3;
}

.you {
  @apply m-0 max-w-11/12 self-end rounded-box rounded-br-sm bg-sunken px-3 py-2 typo-body leading-normal text-pretty whitespace-pre-wrap;
}

.busy {
  @apply m-0 typo-body;
}

.says {
  @apply typo-body;
}

.failure {
  @apply m-0 rounded-field border border-error bg-error-soft px-3 py-2 typo-caption text-error;
}

.foot {
  @apply -mt-1 flex items-center gap-2;
}

.note {
  @apply min-w-0 flex-1 truncate text-subtle normal-case;
}
</style>
