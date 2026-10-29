<script lang="ts" setup>
import type { Component } from "vue";

// One page across conversations, so switching one keeps the tree's folds and every face already opened.
definePageMeta({ key: "conversation" });

const route = useRoute();
const sc = useSidecar();
const chrome = useChrome();
const follow = $follow();
const task = $task();

// Read off disk at build: an unbuilt face is unreachable, with no list kept by hand.
const parts = import.meta.glob<Component>(
  "../../../components/{artifacts/view,conversation/view,files/view,history/view,review/view}.vue",
  { import: "default" },
);

function part(path: string): Component | undefined {
  const load = parts[`../../../components/${path}.vue`];
  return load && defineAsyncComponent(load);
}

const built: Record<Face, Component | undefined> = {
  conversation: part("conversation/view"),
  artifacts: part("artifacts/view"),
  files: part("files/view"),
  history: part("history/view"),
  review: part("review/view"),
};

chrome.view.faces.value = FACES.filter((face) => built[face]);

// A link such as `?face=review`, `?artifact=<slug>` or `?task=<slug>` picks once, then the switcher owns it.
const asked = FACES.find((face) => face === route.query.face);
if (asked) chrome.view.set(asked);
if (typeof route.query.artifact === "string") {
  chrome.view.set("artifacts");
  follow.opening = route.query.artifact;
}
if (typeof route.query.task === "string") task.show({ slug: route.query.task });

const key = computed(() => String(route.params.key ?? ""));
const session = computed(() => sc.sessions.value.find((s) => s.key === key.value));
const face = computed(() => built[chrome.view.current.value]);
const gone = computed(() => sc.ready.value && !session.value);

// A face stays mounted behind the others once opened, so coming back neither reloads a live page nor reads its data again.
const opened = ref<Face[]>([]);
watch(
  () => chrome.view.current.value,
  (now) => {
    if (built[now] && !opened.value.includes(now)) opened.value = [...opened.value, now];
  },
  { immediate: true },
);

// Re-asserted after every pull: the poll re-picks a session whenever the held key is unknown.
watch([key, () => sc.sessions.value], () => (sc.sessionKey.value = key.value), { immediate: true });

loadSidecar();
follow.listen();
</script>

<template>
  <NuxtLayout>
    <!-- Claude Code is the chat, so the dock carries only the notes waiting to go to it. -->
    <template #dock>
      <ComposerNotes v-if="!gone" />
    </template>

    <UiSurface v-if="gone" class="gone" pad="md" shape="island" variant="raised">
      <p class="gone-line">
        No conversation is running under <code>{{ key }}</code
        >.
      </p>
      <UiButton to="/" variant="link">Listen for the next one</UiButton>
    </UiSurface>

    <UiSurface
      v-else
      as="main"
      class="main"
      :aria-label="session ? nameOf(session) : key"
      data-region="conversation-main"
      pad="none"
      variant="raised"
    >
      <template v-if="session">
        <ConversationHeader :session="session" />
        <ConversationFaces :session="session" />
      </template>
      <div class="stage" data-region="conversation-stage" :data-face="chrome.view.current.value">
        <template v-for="one in opened" :key="one">
          <FaceHost v-if="built[one]" :face="one" :view="built[one]" />
        </template>
        <p v-if="!face" class="empty">No view has been built for this conversation yet.</p>
      </div>
      <DockPanel />
    </UiSurface>
  </NuxtLayout>
</template>

<style scoped>
.main {
  @apply absolute inset-0 flex flex-col overflow-hidden;
}

/* Every face owns its own scrolling panes, so the stage clips instead of scrolling them. */
.stage {
  @apply relative min-h-0 flex-1 overflow-hidden;
}

/* Inside the main panel a face's panes are its columns, split by the resizer, rather than cards of their own. */
.stage :deep(.face > section > [data-surface="raised"]:not([data-listed="true"])),
.stage :deep(.face > section > .slot > [data-surface="raised"]:not([data-expanded="true"])) {
  @apply rounded-none border-0 bg-transparent shadow-none;
}

.stage :deep(.face > section > [data-surface="raised"]:first-child:not([data-listed="true"])) {
  @apply border-r border-r-border;
}

.empty {
  @apply m-0 grid h-full place-items-center typo-body text-subtle;
}

.gone {
  @apply absolute top-1/2 left-1/2 flex -translate-1/2 items-center gap-3.5;
}

.gone-line {
  @apply m-0 typo-body text-muted;
}

.gone-line code {
  @apply font-mono text-fg;
}
</style>
