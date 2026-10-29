<script lang="ts" setup>
import { Copy, FileText } from "@lucide/vue";

const { filename, language, meta } = defineProps<{ filename?: string; language?: string; meta?: string }>();
const slots = useSlots();
const conversation = inject(proseConversation, undefined);
const chrome = useChrome();
const links = useLinks();

// A fence names its file as ```ts [src/menu.ts:3-9], which comark hands over as filename, or bare after the language as meta.
const CAPTION = /^([^\s"'`=[\]{}]+?)(?::(\d+)(?:[-–](\d+))?)?$/;

// The fence's raw text sits in `code`'s array children, since comark renders nothing inside a fence as markdown.
const text = computed(() => {
  const [node] = slots.default?.() ?? [];
  const children = node?.children;
  return Array.isArray(children) ? children.filter((one) => typeof one === "string").join("") : "";
});
const command = computed(() => SuggestedCommand.of(text.value));
const html = ref<string>();

const caption = computed(() => {
  const [, path, from, to] = CAPTION.exec((filename ?? meta ?? "").trim()) ?? [];
  if (!path || !/[./]/.test(path)) return undefined;
  const lines: [number, number] | undefined = from ? [Number(from), Number(to || from)] : undefined;
  return { path, lines, range: lines ? `:${lines[0]}–${lines[1]}` : "" };
});

const open = (): void => {
  const at = caption.value;
  if (at) void links.open(at.path, at.lines ? { lines: at.lines } : {});
};

const copy = async (): Promise<void> => {
  await navigator.clipboard
    .writeText(text.value)
    .then(() => chrome.toast("Copied"))
    .catch(() => chrome.toast("The clipboard refused the copy", "destructive"));
};

watch(
  text,
  async (value) => {
    html.value = await Syntax.code(value, language);
  },
  { immediate: true },
);
</script>

<template>
  <figure v-if="conversation" class="code">
    <figcaption class="bar">
      <button v-if="caption" class="file plain-button focusable" data-tip="Open in Files" type="button" @click="open">
        <UiIcon class="file-icon" :icon="FileText" size="xs" />
        <span class="file-path">{{ caption.path }}</span>
        <span class="file-range">{{ caption.range }}</span>
      </button>
      <span v-else class="language">{{ language }}</span>
      <ProseRun v-if="command" :command="command" />
      <UiIconButton :icon="Copy" aria-label="Copy" data-tip="Copy" size="xs" @click="copy" />
    </figcaption>
    <pre class="body"><code v-if="html" v-html="html" /><code v-else>{{ text }}</code></pre>
  </figure>
  <pre v-else><code v-if="html" v-html="html" /><code v-else>{{ text }}</code></pre>
</template>

<style scoped>
.code {
  @apply mx-0 mt-0 mb-2 flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-sunken;
}

.bar {
  @apply flex h-8.5 min-w-0 items-center gap-2 border-b border-b-border pr-1.5 pl-3.5;
}

.file {
  @apply flex min-w-0 flex-1 items-center gap-1.75 border-0 bg-transparent p-0 text-left font-mono typo-mono-micro font-medium text-fg;
}

@media (hover: hover) and (pointer: fine) {
  .file:hover .file-path {
    @apply underline underline-offset-3;
  }
}

.file-icon {
  @apply flex-none text-muted;
}

.file-path {
  @apply min-w-0 truncate;
}

.file-range {
  @apply flex-none text-subtle;
}

.language {
  @apply min-w-0 flex-1 truncate font-mono typo-mono-micro text-subtle;
}

.code .body {
  @apply m-0 rounded-none border-0 bg-transparent px-3.5 py-2.5;
}
</style>
