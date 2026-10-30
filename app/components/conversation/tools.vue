<script lang="ts" setup>
import { Check, ChevronRight, FileText, Pencil, SquareTerminal, Wrench } from "@lucide/vue";
import type { Component } from "vue";
import type { ConversationTurn } from "~/utils/conversation-turn";
import type { ReadFile, ToolRow } from "~/utils/tool-rows";

const { isBusy, results, turns } = defineProps<{
  isBusy: boolean;
  results: Map<string, ConversationTurn>;
  turns: ConversationTurn[];
}>();

const ICONS: Record<ToolRow["kind"], Component> = {
  edit: Pencil,
  other: Wrench,
  read: FileText,
  run: SquareTerminal,
};

const chrome = useChrome();
const links = useLinks();
const reviewPick = useReviewPick();
const opened = ref(new Set<string>());

const rows = computed(() => ToolRows.of({ turns, results, isBusy }));

const canOpen = (row: ToolRow): boolean =>
  row.kind === "read" || row.kind === "run" || (row.kind === "edit" ? !!row.diff : !!row.out);

const toggle = (row: ToolRow): void => {
  if (!canOpen(row)) return;
  const next = new Set(opened.value);
  if (!next.delete(row.key)) next.add(row.key);
  opened.value = next;
};

const openFile = (file: ReadFile): void => void links.open(file.path, file.lines ? { lines: file.lines } : {});

const review = (path: string): void => {
  reviewPick.value = path;
  chrome.view.set("review");
};
</script>

<template>
  <ul class="tools" aria-label="What Claude did">
    <li v-for="row in rows" :key="row.key" class="tool" :data-open="opened.has(row.key)">
      <div class="head">
        <button
          class="toggle plain-button focusable"
          type="button"
          :aria-expanded="canOpen(row) ? opened.has(row.key) : undefined"
          :disabled="!canOpen(row)"
          @click="toggle(row)"
        >
          <UiIcon class="chevron" :icon="ChevronRight" size="xs" />
          <OrgMark v-if="row.state === 'live'" class="mark" mark="working" />
          <UiIcon v-else class="icon" :icon="ICONS[row.kind]" size="xs" />
          <span class="label" :data-live="row.state === 'live'">{{ row.label }}</span>
          <span v-if="row.meta" class="meta">{{ row.meta }}</span>
        </button>
        <template v-if="row.kind === 'edit' && row.diff">
          <span class="add">+{{ row.diff.add }}</span>
          <span class="del">−{{ row.diff.del }}</span>
        </template>
        <span v-else-if="row.state === 'failed'" class="failed">failed</span>
        <UiIcon v-else-if="row.state === 'done' && row.kind !== 'read'" class="done" :icon="Check" size="xs" />
        <UiButton
          v-if="row.kind === 'edit' && row.state !== 'live'"
          class="review"
          data-tip="Open this change in Review"
          size="xs"
          variant="outline"
          @click="review(row.path)"
          >Review</UiButton
        >
      </div>
      <div v-if="opened.has(row.key)" class="body">
        <ul v-if="row.kind === 'read'" class="files">
          <li v-for="file in row.files" :key="`${file.path}:${file.lines}`">
            <button class="file plain-button focusable" data-tip="Open in Files" type="button" @click="openFile(file)">
              <span class="file-path">{{ homePath(file.path) }}</span>
              <span v-if="file.lines" class="file-lines">:{{ file.lines[0] }}–{{ file.lines[1] }}</span>
            </button>
          </li>
        </ul>
        <ConversationHunks v-else-if="row.kind === 'edit' && row.diff" :diff="row.diff" />
        <pre v-else-if="row.kind === 'run'" class="out"><span class="command">$ {{ row.command }}</span>
<template v-if="row.out">{{ row.out }}</template><span v-else class="quiet">{{ row.state === 'live' ? 'Running…' : 'No output' }}</span></pre>
        <pre v-else-if="row.kind === 'other' && row.out" class="out">{{ row.out }}</pre>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.tools {
  @apply m-0 flex list-none flex-col overflow-hidden rounded-xl border border-border p-0;
}

.tool {
  @apply flex min-w-0 flex-col border-t border-t-border first:border-t-0;
}

.head {
  @apply flex h-9 min-w-0 items-center gap-2 pr-2;
}

.toggle {
  @apply flex h-full min-w-0 flex-1 items-center gap-2 border-0 bg-transparent pr-1 pl-2.5 text-left text-fg transition-colors duration-(--duration-fast) ease-out;
}

.toggle:disabled {
  @apply cursor-default;
}

@media (hover: hover) and (pointer: fine) {
  .toggle:not(:disabled):hover {
    @apply bg-sunken;
  }
}

.chevron {
  @apply flex-none text-subtle transition-transform duration-(--duration-fast) ease-out;
}

.toggle:disabled .chevron {
  @apply opacity-0;
}

.tool[data-open="true"] .chevron {
  @apply rotate-90;
}

.icon {
  @apply flex-none text-muted;
}

.mark {
  @apply flex-none;
}

.label {
  @apply max-w-3/5 flex-none truncate typo-caption font-semibold;
}

.label[data-live="true"] {
  @apply shimmer;
}

.meta {
  @apply min-w-0 flex-1 truncate typo-mono-micro text-muted;
}

.add,
.del,
.failed {
  @apply flex-none typo-mono-micro font-semibold;
}

.add {
  @apply text-success;
}

.del,
.failed {
  @apply text-error;
}

.done {
  @apply flex-none text-success;
}

.review {
  @apply ml-1 flex-none;
}

.body {
  @apply border-t border-t-border;
}

.files {
  @apply m-0 flex list-none flex-col bg-sunken px-1.5 py-1.5;
}

.file {
  @apply flex w-full min-w-0 items-baseline rounded-lg border-0 bg-transparent px-2 py-1 text-left font-mono typo-mono-meta text-fg;
}

@media (hover: hover) and (pointer: fine) {
  .file:hover {
    @apply bg-raised;
  }
}

.file-path {
  @apply min-w-0 truncate;
}

.file-lines {
  @apply flex-none text-subtle;
}

.out {
  @apply m-0 max-h-80 overflow-auto bg-sunken px-3.5 py-2.5 font-mono typo-mono-meta leading-relaxed whitespace-pre-wrap text-fg;
}

.command {
  @apply text-muted;
}

.quiet {
  @apply text-subtle;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    @apply transition-none;
  }
}
</style>
