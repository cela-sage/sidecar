<script lang="ts" setup>
import { Paperclip } from "@lucide/vue";
import type { Component } from "vue";
import type { SessionCommand } from "~~/shared/types/command";
import type { AttachedFile } from "~~/shared/types/files";
import type { Typed } from "~/utils/mentions";
import type { OrgConversation } from "~/utils/org";

export interface ComposerPieceItem {
  id: string;
  icon: Component;
  label: string;
  preview?: string;
  tip?: string;
}

const text = defineModel<string>({ required: true });
const {
  attached = [],
  candidates = [],
  commands = [],
  fillOnTab = false,
  isTall = false,
  label,
  opens = "up",
  pieces = [],
  placeholder,
} = defineProps<{
  attached?: AttachedFile[];
  candidates?: OrgConversation[];
  commands?: SessionCommand[];
  fillOnTab?: boolean;
  isTall?: boolean;
  label: string;
  opens?: "up" | "down";
  pieces?: ComposerPieceItem[];
  placeholder: string;
}>();
const emit = defineEmits<{ escape: []; files: [files: File[]]; fill: []; remove: [id: string]; send: [] }>();

const PICKS_MAX = 30;

type Segment = { text: string; kind: "text" | "mention" | "file" };

const box = useTemplateRef<HTMLTextAreaElement>("box");
const mirror = useTemplateRef<HTMLElement>("mirror");
const caret = ref(0);
const cursor = ref(0);
const isDismissed = ref(false);

const track = (): void => {
  caret.value = box.value?.selectionStart ?? text.value.length;
};

const focus = (): void => {
  box.value?.focus();
  track();
};

const edit = (change: (from: Typed) => Typed): void => {
  const next = change({ text: text.value, caret: caret.value });
  text.value = next.text;
  void nextTick(() => {
    box.value?.focus();
    box.value?.setSelectionRange(next.caret, next.caret);
    caret.value = next.caret;
  });
};

const complete = (row: SessionCommand): void => {
  const next = `/${row.name} `;
  edit(() => ({ text: next, caret: next.length }));
};

const {
  cursor: commandCursor,
  onKey: onCommandKey,
  rows: commandRows,
} = useSlashMenu({
  text: () => text.value,
  commands: () => commands,
  complete,
});

const picking = computed(() => {
  const hit = isDismissed.value ? undefined : Mentions.typing({ text: text.value, caret: caret.value });
  return hit && candidates.length && !commandRows.value.length && !attached.some((one) => one.name === hit.query)
    ? hit
    : undefined;
});
const people = computed(() => {
  if (!picking.value) return [];
  const needle = picking.value.query.toLowerCase();
  return candidates.filter((row) => row.title.toLowerCase().includes(needle)).slice(0, PICKS_MAX);
});

const pick = (row: OrgConversation): void => edit((from) => Mentions.insert(from, row));

// The textarea draws no colour of its own, so this copy under it is what shows a mention or a file as one piece.
const segments = computed(() => {
  const marks = [
    ...Mentions.of(text.value).map((one) => ({ ...one, kind: "mention" as const })),
    ...Attachments.of(text.value, attached).map((one) => ({ ...one, kind: "file" as const })),
  ].sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let at = 0;
  for (const one of marks) {
    if (one.start < at) continue;
    if (one.start > at) out.push({ text: text.value.slice(at, one.start), kind: "text" });
    out.push({ text: text.value.slice(one.start, one.end), kind: one.kind });
    at = one.end;
  }
  if (at < text.value.length) out.push({ text: text.value.slice(at), kind: "text" });
  return out;
});

const scroll = (): void => {
  if (mirror.value && box.value) mirror.value.scrollTop = box.value.scrollTop;
};

const take = (event: ClipboardEvent | DragEvent, list?: FileList): void => {
  const files = [...(list ?? [])];
  if (!files.length) return;
  event.preventDefault();
  emit("files", files);
};

const onDragOver = (event: DragEvent): void => {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
};

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

const onPeopleKey = (event: KeyboardEvent): boolean => {
  const step = STEPS[event.key];
  const row = people.value[cursor.value];
  if (step) cursor.value = Math.min(Math.max(cursor.value + step, 0), Math.max(people.value.length - 1, 0));
  else if ((event.key === "Enter" || event.key === "Tab") && row) pick(row);
  else if (event.key === "Escape") isDismissed.value = true;
  else return false;
  event.preventDefault();
  return true;
};

const onKey = (event: KeyboardEvent): void => {
  if (event.isComposing) return;
  if (onCommandKey(event) || (picking.value && onPeopleKey(event))) return;
  if (event.key === "Escape") {
    event.preventDefault();
    emit("escape");
  } else if (event.key === "Tab" && fillOnTab && !event.shiftKey && !text.value.trim()) {
    event.preventDefault();
    emit("fill");
  } else if (isPlainEnter(event)) {
    event.preventDefault();
    emit("send");
  }
};

watch(text, () => {
  isDismissed.value = false;
  cursor.value = 0;
  void nextTick(track);
});

defineExpose({ edit, focus });
</script>

<template>
  <div class="composer" @dragover="onDragOver" @drop="take($event, $event.dataTransfer?.files)">
    <ComposerCommands
      v-if="commandRows.length"
      class="menu"
      :cursor="commandCursor"
      :data-opens="opens"
      :rows="commandRows"
      @pick="complete"
      @point="commandCursor = $event"
    />
    <ComposerMentions
      v-else-if="picking"
      class="menu"
      :cursor="cursor"
      :data-opens="opens"
      :rows="people"
      @pick="pick"
      @point="cursor = $event"
    />
    <div v-if="pieces.length" class="pieces">
      <ComposerPiece
        v-for="one in pieces"
        :key="one.id"
        :icon="one.icon"
        :label="one.label"
        :preview="one.preview"
        :tip="one.tip"
        @remove="emit('remove', one.id)"
      />
    </div>
    <div class="area" :data-tall="isTall">
      <div ref="mirror" class="mirror" aria-hidden="true">
        <template v-for="(one, at) in segments" :key="at"
          ><mark v-if="one.kind === 'mention'" class="mention">{{ one.text }}</mark
          ><mark v-else-if="one.kind === 'file'" class="file"
            ><span class="at">@<Paperclip class="clip" /></span>{{ one.text.slice(1) }}</mark
          ><template v-else>{{ one.text }}</template></template
        >&#8203;
      </div>
      <textarea
        ref="box"
        v-model="text"
        :aria-label="label"
        class="box"
        rows="1"
        :placeholder="placeholder"
        @click="track"
        @keydown="onKey"
        @keyup="track"
        @paste="take($event, $event.clipboardData?.files)"
        @scroll="scroll"
      />
    </div>
  </div>
</template>

<style scoped>
.composer {
  @apply flex min-w-0 flex-col gap-1.5;
}

.menu {
  @apply absolute right-0 bottom-full left-0 z-3 mb-2;
}

.menu[data-opens="down"] {
  @apply top-full bottom-auto mt-2 mb-0;
}

.pieces {
  @apply flex flex-wrap gap-1.5;
}

.area {
  @apply relative;
}

.mirror,
.box {
  @apply m-0 box-border min-h-5.5 w-full border-0 p-0 font-sans typo-body leading-normal break-words whitespace-pre-wrap;
}

.mirror {
  @apply max-h-28 overflow-hidden text-fg;
}

.area[data-tall="true"] .mirror {
  @apply max-h-50;
}

.box {
  @apply absolute inset-0 resize-none overflow-y-auto bg-transparent text-transparent caret-fg outline-none placeholder:text-subtle;
}

.mention {
  @apply rounded-sm bg-primary-soft box-decoration-clone font-semibold text-primary-deep;
}

.file {
  @apply rounded-sm bg-info-soft box-decoration-clone font-semibold text-info;
}

/* The glyph sits over a transparent @, so the copy keeps the textarea's widths and the caret lines up. */
.at {
  @apply relative text-transparent;
}

.clip {
  @apply absolute top-1/2 left-1/2 size-3 -translate-1/2 text-info;
}
</style>
