<script lang="ts" setup>
import { ArrowUp, Paperclip, TextQuote } from "@lucide/vue";
import type { ComposerPieceItem } from "~/components/composer/input.vue";

const {
  hasHistory = false,
  isBusy,
  mode,
  model,
  name,
} = defineProps<{ hasHistory?: boolean; isBusy: boolean; mode?: string; model?: string; name: string }>();

const prompt = $prompt();
const dock = $dock();
const sc = useSidecar();
const tree = useOrgTree();
const input = useTemplateRef<{ focus: () => void }>("input");
const picker = useTemplateRef<HTMLInputElement>("picker");

const canStop = computed(() => isBusy && prompt.isEmpty);

const candidates = computed(() => (sc.sessionKey.value ? Org.mentionable(tree.value, sc.sessionKey.value) : []));

const pieces = computed<ComposerPieceItem[]>(() => [
  ...prompt.blocks.map((one) => ({ id: one.id, icon: TextQuote, label: one.label, tip: one.text.slice(0, 400) })),
  ...prompt.files.map((one) => ({
    id: one.path,
    icon: Paperclip,
    label: one.name,
    preview: one.preview,
    tip: one.path,
  })),
]);

const uploadAll = (files: File[]): void => {
  for (const file of files) void prompt.upload(file);
};

const onEscape = (): void => {
  if (isBusy) void prompt.stop();
};

const onPicked = (): void => {
  uploadAll([...(picker.value?.files ?? [])]);
  if (picker.value) picker.value.value = "";
};

watch(
  () => prompt.focusAsked,
  () => void nextTick(() => input.value?.focus()),
);
</script>

<template>
  <div class="dock" data-region="conversation-prompt" :data-docked="dock.isOpen && dock.isReady">
    <div class="box">
      <ComposerInput
        ref="input"
        v-model="prompt.text"
        :candidates="candidates"
        :commands="prompt.commands"
        is-tall
        :label="`Message ${name}`"
        :pieces="pieces"
        :placeholder="`Message ${name}`"
        @escape="onEscape"
        @files="uploadAll"
        @remove="prompt.unattach"
        @send="prompt.send()"
      />
      <div class="bar">
        <UiIconButton
          :icon="Paperclip"
          aria-label="Attach a file"
          data-tip="Attach a file"
          size="xs"
          @click="picker?.click()"
        />
        <input ref="picker" class="picker" multiple type="file" @change="onPicked" />
        <ConversationModel :current="model" :has-history="hasHistory" />
        <ConversationMode :current="mode" />
        <span class="spacer" />
        <ConversationContext :is-busy="isBusy" />
        <button
          v-if="canStop"
          class="send plain-button focusable"
          aria-label="Stop"
          data-tip="Stop · {esc}"
          type="button"
          @click="prompt.stop()"
        >
          <span class="stop-square" aria-hidden="true" />
        </button>
        <button
          v-else
          class="send plain-button focusable"
          aria-label="Send"
          :data-tip="isBusy ? 'Send, after the turn in flight · {enter}' : 'Send · {enter}'"
          :disabled="prompt.isEmpty || prompt.isSending"
          type="button"
          @click="prompt.send()"
        >
          <UiIcon :icon="ArrowUp" size="sm" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Clear of the door's pill and the notes, which float over the panel's bottom unless the terminal dock is under it. */
.dock {
  @apply mx-auto box-border w-full max-w-175 flex-none pr-34 pl-6;
  padding-bottom: max(--spacing(3.5), calc(var(--dock-h, 0px) + var(--gutter)));
}

.dock[data-docked="true"] {
  @apply pr-6 pb-3.5;
}

.box {
  @apply relative flex flex-col gap-1.5 rounded-2xl border border-border-strong bg-raised pt-2.5 pr-2.5 pb-2 pl-3.5 shadow-sm transition-colors duration-(--duration-fast) ease-out;
}

.box:focus-within {
  @apply border-fg;
}

.bar {
  @apply flex items-center gap-2;
}

.bar > :first-child {
  @apply -ml-1.5;
}

.picker {
  @apply hidden;
}

.spacer {
  @apply flex-1;
}

.send {
  @apply inline-flex size-7.5 flex-none items-center justify-center rounded-full border-0 bg-fg text-canvas transition-colors duration-(--duration-fast) ease-out;
}

.send:disabled {
  @apply bg-sunken text-subtle;
}

.stop-square {
  @apply size-2.75 rounded-xs bg-current;
}
</style>
