<script lang="ts">
import { createMarkdownParser } from "comark";
import taskList from "comark/plugins/task-list";
import type { MarkdownDocument as Tree } from "comark";
import { proseConversation } from "~/utils/prose-keys";
import ProseCode from "./prose-code.vue";
import ProseConversation from "./prose-conversation.vue";
import ProseFile from "./prose-file.vue";
import ProseLine from "./prose-line.vue";
import ProseLink from "./prose-link.vue";
import ProseMediaRef from "./prose-media-ref.vue";
import ProseMediaSet from "./prose-media-set.vue";

const parse = createMarkdownParser({
  // Turns arrive whole over SSE; autoClose only mangles multi-line emphasis into a stray `**`.
  autoClose: false,
  plugins: [taskList()],
  // No html plugin: turn text is untrusted and its XML wrappers must stay literal.
  registerDefaultPlugins: false,
});

const COMPONENTS = {
  a: ProseLink,
  "conversation-ref": ProseConversation,
  "file-ref": ProseFile,
  "line-ref": ProseLine,
  "media-ref": ProseMediaRef,
  "media-set": ProseMediaSet,
  pre: ProseCode,
};
</script>

<script lang="ts" setup>
const { conversation, lineRefsOf, value } = defineProps<{ conversation?: string; lineRefsOf?: string; value: string }>();

const tree = shallowRef<Tree>();
const org = useOrgTree();
const titles = computed(() => (conversation ? Org.titles(org.value) : undefined));
// The tree changes with every status dot, and only a change to this list is worth parsing a reply again.
const known = computed(() => JSON.stringify([...(titles.value ?? [])]));

if (conversation) provide(proseConversation, conversation);

watch(
  [() => value, known],
  async ([next]) => {
    const parsed = await parse(next);
    if (next !== value) return;
    const refs = ConversationRefs.withRefs(parsed.nodes, titles.value);
    const nodes = conversation ? FileRefs.withRefs(MediaRefs.withMedia(refs)) : refs;
    tree.value = { ...parsed, nodes: lineRefsOf ? SideQuestion.withLineRefs(nodes, lineRefsOf) : nodes };
  },
  { immediate: true },
);
</script>

<template>
  <div class="prose">
    <MarkdownDocument v-if="tree" :components="COMPONENTS" :value="tree" />
    <p v-else class="raw">{{ value }}</p>
  </div>
</template>

<style scoped>
.prose {
  @apply min-w-0 typo-body wrap-anywhere;
}

.raw {
  @apply m-0 whitespace-pre-wrap;
}

.prose :deep(> :first-child) {
  @apply mt-0;
}

.prose :deep(> :last-child) {
  @apply mb-0;
}

.prose :deep(p) {
  @apply mx-0 mt-0 mb-2;
}

.prose :deep(h1),
.prose :deep(h2),
.prose :deep(h3),
.prose :deep(h4),
.prose :deep(h5),
.prose :deep(h6) {
  @apply mx-0 mt-3 mb-1.5 typo-body-strong leading-snug font-bold;
}

.prose :deep(h1) {
  @apply typo-heading;
}

.prose :deep(h2) {
  @apply typo-subheading font-bold;
}

.prose :deep(ul),
.prose :deep(ol) {
  @apply mx-0 mt-0 mb-2 pl-4.5;
}

.prose :deep(li) {
  @apply mx-0 mt-0 mb-0.75;
}

.prose :deep(li > p) {
  @apply m-0;
}

.prose :deep(.contains-task-list) {
  @apply list-none pl-0.5;
}

.prose :deep(.task-list-item-checkbox) {
  @apply pointer-events-none mr-1.5 align-baseline accent-primary;
}

.prose :deep(a) {
  @apply text-primary underline underline-offset-2;
}

.prose :deep(a:hover) {
  @apply decoration-2;
}

.prose :deep(code) {
  @apply rounded-selector border border-border bg-raised px-1 py-px font-mono typo-caption;
}

/* The bubble is width-capped, so a long line has to scroll here or it drags the layout wider. */
.prose :deep(pre) {
  @apply mx-0 mt-0 mb-2 max-w-full overflow-x-auto rounded-field border border-border bg-raised px-2.5 py-2;
}

.prose :deep(pre code) {
  @apply border-0 bg-transparent bg-none p-0 whitespace-pre;
}

.prose :deep(blockquote) {
  @apply mx-0 mt-0 mb-2 rounded-r-selector border-l-3 border-l-border-strong bg-sunken px-3 py-1.5 typo-caption leading-normal text-muted;
}

.prose :deep(blockquote > :last-child) {
  @apply mb-0;
}

.prose :deep(hr) {
  @apply mx-0 my-3 border-0 border-t border-t-border;
}

.prose :deep(table) {
  @apply mx-0 mt-0 mb-2 block w-max max-w-full border-collapse overflow-x-auto;
}

.prose :deep(th),
.prose :deep(td) {
  @apply border-b border-b-border py-1 pr-2.5 pl-0 text-left align-top;
}

.prose :deep(th) {
  @apply font-semibold whitespace-nowrap text-subtle;
}

.prose :deep(img) {
  @apply max-w-full rounded-field;
}

.prose :deep(.media-set) {
  @apply mt-2.5 mb-3;
}
</style>
