<script lang="ts" setup>
import { Check, ChevronLeft, Maximize2, Pencil } from "@lucide/vue";
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
const story = computed(() => Timeline.story(task.entries, meta.task.state));
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
const tint = computed(() =>
  Tasks.tintOf(
    project?.key,
    task.projects.map((one) => one.key),
  ),
);
const updated = computed(() =>
  meta.updated ? new Date(meta.updated).toLocaleDateString([], { day: "numeric", month: "short" }) : "",
);
const eyebrow = computed(() =>
  ["Task", project ? `on ${project.name}` : "in the backlog", updated.value && `updated ${updated.value}`]
    .filter(Boolean)
    .join(" · "),
);
const saved = computed(() => {
  if (task.isEditing) return savedAt.value ? `editing · saved ${savedAt.value}` : "editing · markdown";
  return updated.value ? `markdown · saved ${updated.value}` : "markdown";
});

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
        <button
          class="crumb plain-button focusable"
          data-region="task-back"
          data-tip="Back to the conversation · {esc}"
          type="button"
          @click="task.close()"
        >
          <UiIcon :icon="ChevronLeft" size="xs" />Back
        </button>
        <span class="square" :data-tint="tint" />
        <span class="project">{{ project?.name ?? "Backlog" }}</span>
        <span class="slash">/</span>
        <span class="name">{{ title }}</span>
        <TaskStatePick :meta="meta" />
        <UiSegmented
          v-if="!task.isEditing"
          v-model="task.face"
          class="faces"
          data-region="task-face"
          :options="faces"
          variant="track"
        />
        <span class="spacer" />
        <span class="saved mono-meta">{{ saved }}</span>
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
      </header>

      <TaskEditor v-if="task.isEditing" :key="meta.slug" ref="editor" :slug="meta.slug" @saved="savedAt = $event" />
      <div v-else class="body">
        <TaskHistory v-if="task.face === 'history'" :meta="meta" />
        <div v-else class="doc">
          <article class="column">
            <div class="lead">
              <span class="eyebrow mono-meta">{{ eyebrow }}</span>
              <h1 class="title">{{ title }}</h1>
              <TaskStrip :state="meta.task.state" :story="story" />
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
            <TaskFold v-if="isBlocked && isFolded && task.parts.length" :parts="task.parts" @open="isFolded = false" />
            <template v-else>
              <ArtifactReader v-if="conversation" :conversation="conversation" :slug="meta.slug" />
              <ArtifactFrame v-else :slug="meta.slug" />
            </template>
          </article>
        </div>
        <TaskRail :asking="asking" :conversation="conversation" :sessions="rail" :slug="meta.slug" />
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

.crumb {
  @apply inline-flex h-6.5 flex-none items-center gap-1 rounded-lg border-0 bg-transparent px-1.5 typo-caption font-semibold text-muted transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .crumb:hover {
    @apply bg-sunken text-fg;
  }
}

.faces {
  @apply ml-1.5 flex-none;
}

.square {
  @apply size-2.25 flex-none rounded-sm bg-tint;
}

.project {
  @apply flex-none typo-caption-strong text-muted;
}

.slash {
  @apply flex-none typo-caption text-subtle;
}

.name {
  @apply min-w-0 truncate typo-body-strong font-bold;
}

.spacer {
  @apply flex-1;
}

.saved {
  @apply flex-none text-muted;
}

.body {
  @apply grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_--spacing(85)];
}

.doc {
  @apply flex min-w-0 justify-center overflow-y-auto px-9 pt-6 pb-(--float-clear);
}

.column {
  @apply flex w-full max-w-160 flex-col gap-4.5;
}

.lead {
  @apply flex flex-col gap-3;
}

.eyebrow {
  @apply text-subtle;
}

.title {
  @apply m-0 typo-display font-extrabold;
}
</style>
