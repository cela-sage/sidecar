<script lang="ts" setup>
import { ArrowUp, AtSign, Bell, BellOff } from "@lucide/vue";
import type { Typed } from "~/utils/mentions";

const { placeholder, thread } = defineProps<{ placeholder: string; thread?: string }>();

const channel = $channel();
const text = ref("");
const input = useTemplateRef<{ edit: (change: (from: Typed) => Typed) => void; focus: () => void }>("input");

const hint = computed(() => ChannelPicker.reachOf(text.value, channel.cast));
const isEmpty = computed(() => !text.value.trim());

const mention = (): void =>
  input.value?.edit(({ text: was, caret }) => {
    const lead = caret && !/\s$/.test(was.slice(0, caret)) ? " @" : "@";
    return { text: `${was.slice(0, caret)}${lead}${was.slice(caret)}`, caret: caret + lead.length };
  });

const send = async (): Promise<void> => {
  if (isEmpty.value || channel.isSending) return;
  if (await channel.post(text.value, thread)) text.value = "";
};

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <div class="composer" :data-reply="!!thread">
    <ComposerInput
      ref="input"
      v-model="text"
      :label="placeholder"
      :placeholder="placeholder"
      :roster="channel.roster"
      @send="send"
    />
    <div class="bar">
      <UiIconButton
        v-if="!thread"
        :icon="AtSign"
        aria-label="Mention"
        data-tip="Mention someone · @"
        size="xs"
        @click="mention"
      />
      <span class="spacer" />
      <span
        v-if="!thread"
        class="hint"
        data-tip="No @ notifies no one. @name notifies that agent and interrupts its turn; @all does it to everyone"
        ><UiIcon :icon="hint === ChannelPicker.quiet ? BellOff : Bell" size="xs" />{{ hint }}</span
      >
      <button
        class="send plain-button focusable"
        :aria-label="thread ? 'Reply' : 'Send'"
        :data-tip="thread ? 'Reply · {enter}' : 'Send · {enter}'"
        :disabled="isEmpty || channel.isSending"
        type="button"
        @click="send"
      >
        <UiIcon :icon="ArrowUp" size="sm" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  @apply relative flex flex-col gap-1.5 rounded-2xl border border-border-strong bg-raised pt-2.5 pr-2.5 pb-2 pl-3.5 shadow-sm transition-colors duration-(--duration-fast) ease-out;
}

.composer:focus-within {
  @apply border-fg;
}

.bar {
  @apply flex items-center gap-2;
}

.bar > :first-child {
  @apply -ml-1.5;
}

.spacer {
  @apply flex-1;
}

.hint {
  @apply inline-flex flex-none items-center gap-1.5 typo-mono-micro font-medium whitespace-nowrap text-muted;
}

.send {
  @apply inline-flex size-7.5 flex-none items-center justify-center rounded-full border-0 bg-fg text-canvas transition-colors duration-(--duration-fast) ease-out;
}

.composer[data-reply="true"] .send {
  @apply size-7;
}

.send:disabled {
  @apply bg-sunken text-subtle;
}

@media (prefers-reduced-motion: reduce) {
  .composer,
  .send {
    @apply transition-none;
  }
}
</style>
