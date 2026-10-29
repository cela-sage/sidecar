<script lang="ts" setup>
import { ArrowUp, Paperclip, TextQuote } from "@lucide/vue";

const {
  hasHistory = false,
  isBusy,
  model,
  name,
} = defineProps<{ hasHistory?: boolean; isBusy: boolean; model?: string; name: string }>();

const prompt = $prompt();
const dock = $dock();
const box = useTemplateRef<HTMLTextAreaElement>("box");
const picker = useTemplateRef<HTMLInputElement>("picker");

const canStop = computed(() => isBusy && prompt.isEmpty);

const uploadAll = (files: File[]): void => {
  for (const file of files) void prompt.upload(file);
};

const onKey = (event: KeyboardEvent): void => {
  if (event.isComposing) return;
  if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    void prompt.send();
  } else if (event.key === "Escape" && isBusy) {
    event.preventDefault();
    void prompt.stop();
  }
};

const onPaste = (event: ClipboardEvent): void => {
  const files = [...(event.clipboardData?.files ?? [])];
  if (!files.length) return;
  event.preventDefault();
  uploadAll(files);
};

const onDrop = (event: DragEvent): void => {
  const files = [...(event.dataTransfer?.files ?? [])];
  if (!files.length) return;
  event.preventDefault();
  uploadAll(files);
};

const onPicked = (): void => {
  uploadAll([...(picker.value?.files ?? [])]);
  if (picker.value) picker.value.value = "";
};

watch(
  () => prompt.focusAsked,
  () => void nextTick(() => box.value?.focus()),
);
</script>

<template>
  <div class="dock" data-region="conversation-prompt" :data-docked="dock.isOpen && dock.isReady">
    <div class="box" @dragover.prevent @drop="onDrop">
      <div v-if="prompt.blocks.length || prompt.files.length" class="attached">
        <ComposerPiece
          v-for="one in prompt.blocks"
          :key="one.id"
          :icon="TextQuote"
          :label="one.label"
          :tip="one.text.slice(0, 400)"
          @remove="prompt.unattach(one.id)"
        />
        <ComposerPiece
          v-for="one in prompt.files"
          :key="one.path"
          :icon="Paperclip"
          :label="one.name"
          :preview="one.preview"
          :tip="one.path"
          @remove="prompt.unattach(one.path)"
        />
      </div>
      <textarea
        ref="box"
        v-model="prompt.text"
        :aria-label="`Message ${name}`"
        class="field"
        :placeholder="`Message ${name}`"
        rows="1"
        @keydown="onKey"
        @paste="onPaste"
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
        <span class="spacer" />
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
  @apply flex flex-col gap-1.5 rounded-2xl border border-border-strong bg-raised pt-2.5 pr-2.5 pb-2 pl-3.5 shadow-sm transition-colors duration-(--duration-fast) ease-out;
}

.box:focus-within {
  @apply border-fg;
}

.attached {
  @apply flex flex-wrap gap-1.5;
}

.field {
  @apply m-0 max-h-50 min-h-5.5 w-full resize-none border-0 bg-transparent p-0 font-sans typo-body leading-normal text-fg outline-none placeholder:text-subtle;
  field-sizing: content;
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
