<script lang="ts" setup>
import { Check, Maximize2, PanelRight, Pencil } from "@lucide/vue";
import { useEventListener } from "@vueuse/core";
import { isTyping } from "~~/lib/web/page/blocks";
import type { ReviewThread } from "~~/shared/types/artifact";
import type { LiveSession } from "~~/shared/types/session";
import type { Project } from "~~/shared/types/task";
import type { TaskMeta } from "~/utils/tasks";

const { conversation, meta, project, rail } = defineProps<{
  conversation?: string;
  meta: TaskMeta;
  project?: Project;
  rail: LiveSession[];
}>();

interface EditorHandle {
  finish: () => Promise<boolean>;
}

const task = $task();
const artifact = $artifact();
const shown = useFaceShown();
const { decide, isSending } = useTaskDecide();
const editor = useTemplateRef<EditorHandle>("editor");
const savedAt = ref<string>();
const isFolded = ref(true);

const asking = computed(() => task.asks.filter((thread) => thread.status !== "resolved"));
const isBlocked = computed(() => asking.value.some((thread) => thread.ask?.kind === "escalation"));
const isShut = computed(() => isBlocked.value && isFolded.value && !!task.parts.length);
const tree = useOrgTree();
const status = computed(() => Org.statusOf(tree.value, meta.slug) ?? meta.task.state);
const story = computed(() => Timeline.story(task.entries, status.value));
const settled = computed(() => {
  if (!story.value.settledBy) return undefined;
  const decided = task.asks.filter((thread) => thread.ask?.kind === "escalation" && !!thread.ask.decision);
  return decided.sort((a, b) => (a.ask?.decision?.at ?? "").localeCompare(b.ask?.decision?.at ?? "")).at(-1);
});

function showHistory(thread: ReviewThread): void {
  task.picked = task.entries.findLastIndex((entry) => entry.kind === "decide" && entry.thread === thread.id);
  task.face = "history";
}

const faces = computed(() => [
  { label: "Document", value: "document" as const },
  { label: "History", value: "history" as const, count: task.entries.filter((one) => one.kind !== "read").length },
]);

const title = computed(() => meta.title || deslug(meta.slug));
const updated = computed(() =>
  meta.updated ? new Date(meta.updated).toLocaleDateString([], { day: "numeric", month: "short" }) : "",
);
const eyebrow = computed(() =>
  ["Task", project ? `on ${project.name}` : "in the backlog", updated.value && `updated ${updated.value}`]
    .filter(Boolean)
    .join(" · "),
);
const saved = computed(() => (savedAt.value ? `editing · saved ${savedAt.value}` : "editing · markdown"));

async function done(): Promise<void> {
  if (!editor.value || (await editor.value.finish())) task.isEditing = false;
}

watch(
  () => meta.slug,
  (slug) => {
    task.isEditing = task.takeEdit(slug);
    savedAt.value = undefined;
    isFolded.value = true;
  },
  { immediate: true },
);

watch(
  () => asking.value.length,
  (count, was = 0) => {
    if (count > was) isFolded.value = true;
  },
);

// Esc is read once the press is done, since the app's handler claims one that closes something first.
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (!shown.value || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (event.key === "Escape" && !artifact.isFull)
    setTimeout(() => {
      if (event.defaultPrevented) return;
      if (task.isEditing) void done();
      else if (!isTyping(event.target)) task.close();
    });
  if (event.key.toLowerCase() === "e" && !task.isEditing && !isTyping(event.target)) {
    event.preventDefault();
    task.isEditing = true;
  }
});

onBeforeUnmount(() => (task.isEditing = false));
</script>

<template>
  <ArtifactSheet list-name="Tasks" :slug="meta.slug">
    <div class="task" data-region="task-sheet" :data-editing="task.isEditing">
      <header class="bar">
        <UiSegmented
          v-if="!task.isEditing"
          v-model="task.face"
          class="faces"
          data-region="task-face"
          :options="faces"
          variant="track"
        />
        <span v-else class="saved mono-meta">{{ saved }}</span>
        <span class="spacer" />
        <UiButton
          v-if="task.isEditing"
          aria-pressed="true"
          data-region="task-done"
          data-tip="Done · {esc}"
          :icon="Check"
          size="xs"
          variant="secondary"
          @click="done"
          >Done</UiButton
        >
        <ChromeAction
          v-else
          data-region="task-edit"
          :icon="Pencil"
          label="Edit"
          shape="pill"
          tip="Edit · {E}"
          @click="task.isEditing = true"
        />
        <ChromeCommentToggle shape="pill" />
        <ChromeAction
          v-if="!artifact.isFull"
          data-region="task-grow"
          :icon="Maximize2"
          label="Fullscreen"
          shape="pill"
          tip="Grow the page over everything · {esc} shrinks it back"
          @click="artifact.isFull = true"
        />
        <ChromeAction
          data-region="task-rail-toggle"
          :icon="PanelRight"
          :is-pressed="task.hasRail"
          :label="String(rail.length)"
          shape="pill"
          :tip="`${task.hasRail ? 'Hide' : 'Show'} the conversations on this task`"
          @click="task.hasRail = !task.hasRail"
        />
      </header>

      <TaskEditor v-if="task.isEditing" :key="meta.slug" ref="editor" :slug="meta.slug" @saved="savedAt = $event" />
      <div v-else class="body" :data-rail="task.hasRail">
        <TaskHistory v-if="task.face === 'history'" :meta="meta" />
        <article v-else class="doc">
          <div class="lead">
            <div class="head">
              <span class="eyebrow mono-meta">{{ eyebrow }}</span>
              <h1 class="title">{{ title }}</h1>
              <TaskStrip :meta="meta" :status="status" :story="story" />
            </div>
            <TaskEscalation
              v-for="thread in asking"
              :key="thread.id"
              :is-sending="isSending"
              :thread="thread"
              @decide="decide(thread, $event)"
            />
            <TaskSettled v-if="settled" :thread="settled" @history="showHistory(settled)" />
            <TaskNote :story="story" />
            <TaskFold v-if="isShut" :parts="task.parts" @open="isFolded = false" />
          </div>
          <template v-if="!isShut">
            <ArtifactReader v-if="conversation" :conversation="conversation" :slug="meta.slug" />
            <ArtifactFrame v-else :slug="meta.slug" />
          </template>
        </article>
        <TaskRail
          v-if="task.hasRail"
          :asking="asking"
          :conversation="conversation"
          :sessions="rail"
          :slug="meta.slug"
        />
      </div>
    </div>
  </ArtifactSheet>
</template>

<style scoped>
.task {
  @apply flex min-h-0 flex-1 flex-col;
}

.bar {
  @apply flex flex-none items-center gap-2 border-b border-b-border py-2 pr-3 pl-2 whitespace-nowrap;
}

.faces {
  @apply flex-none;
}

.spacer {
  @apply flex-1;
}

.saved {
  @apply flex-none pl-1 text-muted;
}

.body {
  @apply grid min-h-0 flex-1 grid-cols-1;
}

.body[data-rail="true"] {
  @apply grid-cols-[minmax(0,1fr)_--spacing(72)];
}

.doc {
  @apply flex min-w-0 flex-col overflow-y-auto pt-6 pb-(--float-clear);
}

.lead {
  @apply mx-auto flex w-full max-w-190 flex-col gap-4.5 px-6;
}

.head {
  @apply flex flex-col gap-3;
}

.eyebrow {
  @apply text-subtle;
}

.title {
  @apply m-0 typo-display font-extrabold;
}
</style>
