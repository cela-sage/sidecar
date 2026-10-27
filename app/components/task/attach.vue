<script lang="ts" setup>
import { Terminal } from "@lucide/vue";

const { conversation } = defineProps<{ conversation: string }>();

const terminal = $terminal();

const isHeld = computed(() => terminal.state.held?.key === conversation);
const tip = computed(() => {
  if (isHeld.value) return "Your terminal holds this one";
  if (terminal.state.following) return "Attach in your terminal. The follower detaches the current one first";
  return "Copies the claude attach line, since sidecar terminal isn't following";
});

const press = (): void => {
  if (!isHeld.value) void terminal.attach(conversation);
};
</script>

<template>
  <UiButton
    class="attach"
    data-region="task-attach"
    :aria-pressed="isHeld"
    :data-tip="tip"
    :disabled="terminal.switching === conversation"
    :icon="Terminal"
    size="xs"
    variant="outline"
    @click.stop="press"
    >Attach</UiButton
  >
</template>

<style scoped>
.attach {
  @apply flex-none text-muted;
}

.attach[aria-pressed="true"] {
  @apply cursor-default border-border-strong bg-sunken text-fg;
}
</style>
