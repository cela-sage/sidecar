<script lang="ts" setup>
import { Paperclip } from "@lucide/vue";
import type { OrgConversation } from "~/utils/org";

const text = defineModel<string>({ required: true });
const { candidates, placeholder } = defineProps<{ candidates: OrgConversation[]; placeholder: string }>();
const emit = defineEmits<{ escape: []; fill: []; send: [] }>();

const PICKS_MAX = 30;

type Segment = { text: string; kind: "text" | "mention" | "file" };

const door = $door();
const box = useTemplateRef<HTMLTextAreaElement>("box");
const mirror = useTemplateRef<HTMLElement>("mirror");
const caret = ref(0);
const cursor = ref(0);
const isDismissed = ref(false);

const picking = computed(() => {
  const hit = isDismissed.value ? undefined : Mentions.typing({ text: text.value, caret: caret.value });
  return hit && !door.attached.some((one) => one.name === hit.query) ? hit : undefined;
});
const rows = computed(() => {
  if (!picking.value) return [];
  const needle = picking.value.query.toLowerCase();
  return candidates.filter((row) => row.title.toLowerCase().includes(needle)).slice(0, PICKS_MAX);
});

// The textarea draws no colour of its own, so this copy under it is what shows a mention or a file as one piece.
const segments = computed(() => {
  const marks = [
    ...Mentions.of(text.value).map((one) => ({ ...one, kind: "mention" as const })),
    ...Attachments.of(text.value, door.attached).map((one) => ({ ...one, kind: "file" as const })),
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

const track = (): void => {
  caret.value = box.value?.selectionStart ?? text.value.length;
};

const scroll = (): void => {
  if (mirror.value && box.value) mirror.value.scrollTop = box.value.scrollTop;
};

const focus = (): void => {
  box.value?.focus();
  track();
};

const pick = (row: OrgConversation): void => {
  const next = Mentions.insert({ text: text.value, caret: caret.value }, row);
  text.value = next.text;
  void nextTick(() => {
    box.value?.focus();
    box.value?.setSelectionRange(next.caret, next.caret);
    caret.value = next.caret;
  });
};

const attachAll = async (files: File[]): Promise<void> => {
  for (const file of files) {
    const got = await door.attach(file);
    if (!got) continue;
    const next = Attachments.insert({ text: text.value, caret: caret.value }, got.name);
    text.value = next.text;
    caret.value = next.caret;
    await nextTick();
    box.value?.focus();
    box.value?.setSelectionRange(next.caret, next.caret);
  }
};

const onPaste = (event: ClipboardEvent): void => {
  const files = [...(event.clipboardData?.files ?? [])];
  if (!files.length) return;
  event.preventDefault();
  void attachAll(files);
};

const onDragOver = (event: DragEvent): void => {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
};

const onDrop = (event: DragEvent): void => {
  const files = [...(event.dataTransfer?.files ?? [])];
  if (!files.length) return;
  event.preventDefault();
  void attachAll(files);
};

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

const onPicking = (event: KeyboardEvent): boolean => {
  const step = STEPS[event.key];
  const row = rows.value[cursor.value];
  if (step) cursor.value = Math.min(Math.max(cursor.value + step, 0), Math.max(rows.value.length - 1, 0));
  else if ((event.key === "Enter" || event.key === "Tab") && row) pick(row);
  else if (event.key === "Escape") isDismissed.value = true;
  else return false;
  event.preventDefault();
  return true;
};

const onKey = (event: KeyboardEvent): void => {
  if (picking.value && onPicking(event)) return;
  if (event.key === "Escape") {
    event.preventDefault();
    emit("escape");
  } else if (event.key === "Tab" && !event.shiftKey && !text.value.trim()) {
    event.preventDefault();
    emit("fill");
  } else if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    emit("send");
  }
};

watch(text, () => {
  isDismissed.value = false;
  cursor.value = 0;
  void nextTick(track);
});

defineExpose({ focus });
</script>

<template>
  <div class="field">
    <DoorMentions v-if="picking" class="picker" :cursor="cursor" :rows="rows" @pick="pick" @point="cursor = $event" />
    <div class="area">
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
        aria-label="Ask the assistant"
        class="box"
        rows="1"
        :placeholder="placeholder"
        @click="track"
        @dragover="onDragOver"
        @drop="onDrop"
        @keydown="onKey"
        @paste="onPaste"
        @keyup="track"
        @scroll="scroll"
      />
    </div>
  </div>
</template>

<style scoped>
.field {
  @apply relative min-w-0 flex-1;
}

.picker {
  @apply absolute right-0 bottom-full left-0 z-3 mb-2;
}

.area {
  @apply relative;
}

.mirror,
.box {
  @apply m-0 box-border w-full border-0 px-0 py-1.25 font-sans typo-body leading-relaxed break-words whitespace-pre-wrap;
}

.mirror {
  @apply max-h-28 overflow-hidden text-fg;
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
