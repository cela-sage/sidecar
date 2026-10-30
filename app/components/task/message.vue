<script lang="ts" setup>
import type { CommandCall } from "~~/shared/utils/slash-command";
import type { Delivery } from "~/stores/notes";

const { conversation, name, slug } = defineProps<{ conversation: string; name: string; slug: string }>();

const notes = $notes();
const prompt = $prompt();
const chrome = useChrome();
const tree = useOrgTree();
const words = ref("");

const candidates = computed(() => Org.mentionable(tree.value, conversation));
const commands = computed(() => prompt.commandsOf(conversation));

const FAILED: Record<Exclude<Delivery, { delivered: true }>["reason"], string> = {
  "no-live-session": "isn't running and didn't wake, so the message stays here",
  "refused-by-inbox": "refused the message. It stays here, try again in a moment",
};

const run = async (command: CommandCall): Promise<void> => {
  const ran = await prompt.run(conversation, command);
  if (ran === "terminal") return chrome.toast(`Run /${command.name} in your terminal`, "warning");
  if (ran === "failed") return;
  words.value = "";
  chrome.toast(`Ran /${command.name} in ${name}`, "success");
};

const send = async (): Promise<void> => {
  const text = words.value.trim();
  if (!text) return;
  const command = SlashCommand.parse(text);
  if (command) return run(command);
  const reply = await notes.deliver({ key: conversation, slug, text });
  if (!reply) return;
  if (!reply.delivered) return chrome.toast(`${name} ${FAILED[reply.reason]}`, "warning");
  words.value = "";
  chrome.toast(`Sent to ${name}, and it's in the task history`, "success");
};

onMounted(() => void prompt.load(conversation));
</script>

<template>
  <form class="message" data-region="task-message" @click.stop @submit.prevent="send">
    <ComposerInput
      v-model="words"
      :candidates="candidates"
      class="entry"
      :commands="commands"
      label="Message this Individual Contributor"
      opens="down"
      placeholder="Message this Individual Contributor"
      @send="send"
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
  @apply relative ml-4 flex items-center gap-1.5 rounded-full border border-border bg-raised py-0.75 pr-0.75 pl-3;
}

.message:focus-within {
  @apply border-border-strong;
}

.entry {
  @apply flex-1;
}
</style>
