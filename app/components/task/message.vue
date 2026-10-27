<script lang="ts" setup>
import type { Delivery } from "~/stores/notes";

const { conversation, name, slug } = defineProps<{ conversation: string; name: string; slug: string }>();

const notes = $notes();
const chrome = useChrome();
const words = ref("");

const FAILED: Record<Exclude<Delivery, { delivered: true }>["reason"], string> = {
  "no-live-session": "isn't running, so the message stays here",
  "refused-by-inbox": "refused the message. It stays here, try again in a moment",
};

const send = async (): Promise<void> => {
  const text = words.value.trim();
  if (!text) return;
  const reply = await notes.deliver({ key: conversation, slug, text });
  if (!reply) return;
  if (!reply.delivered) return chrome.toast(`${name} ${FAILED[reply.reason]}`, "warning");
  words.value = "";
  chrome.toast(`Sent to ${name}, and it's in the task history`, "success");
};
</script>

<template>
  <form class="message" data-region="task-message" @click.stop @submit.prevent="send">
    <input
      v-model="words"
      class="field"
      type="text"
      aria-label="Message this Task Lead"
      placeholder="Message this Task Lead"
    />
    <UiButton
      data-tip="Send · {↵}. It lands in the task history"
      :disabled="!words.trim() || notes.isSending"
      size="xs"
      type="submit"
      variant="secondary"
      >Send</UiButton
    >
  </form>
</template>

<style scoped>
.message {
  @apply ml-4 flex items-center gap-1.5 rounded-full border border-border bg-raised py-0.75 pr-0.75 pl-3;
}

.message:focus-within {
  @apply border-border-strong;
}

.field {
  @apply min-w-0 flex-1 border-0 bg-transparent p-0 font-sans typo-body text-fg outline-none placeholder:text-subtle;
}
</style>
