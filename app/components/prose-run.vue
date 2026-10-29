<script lang="ts" setup>
import { Play } from "@lucide/vue";

const { command } = defineProps<{ command: string }>();

const conversation = inject(proseConversation, undefined);
const runs = $runs();
const isStarting = ref(false);

const run = async (): Promise<void> => {
  if (!conversation || isStarting.value) return;
  isStarting.value = true;
  await runs.startCommand(conversation, command).finally(() => (isStarting.value = false));
};
</script>

<template>
  <UiIconButton
    v-if="conversation"
    aria-label="Run"
    data-tip="Run in the dock"
    :disabled="isStarting"
    :icon="Play"
    size="xs"
    @click="run"
  />
</template>
