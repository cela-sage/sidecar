<script lang="ts" setup>
import { ListChecks, X } from "@lucide/vue";
import type { TaskFace } from "~/stores/task";

const BOARD = "tasks" as const;

type Board = typeof BOARD;

const route = useRoute();
const chrome = useChrome();
const sc = useSidecar();

const LABELS: Record<Face, string> = { artifacts: "Artifacts", files: "Files", history: "History", review: "Review" };

// With the server down every route shows the reconnecting screen, which has nothing to switch.
const inSession = computed(() => !sc.failure.value && route.path.startsWith("/c/"));
// A routed artifact has no faces to switch; a grown one keeps the row as it was, so the row fades out and back unchanged.
const onArtifact = computed(() => inSession.value && !!route.params.slug);
const onFaces = computed(() => inSession.value && !onArtifact.value && chrome.view.faces.value.length > 0);
const onTask = computed(() => !sc.failure.value && route.path.startsWith("/tasks/"));
const elsewhere = computed(() => !sc.failure.value && !onFaces.value && !onTask.value && route.path !== "/desk");

const open = computed(() => Tasks.of(sc.catalogue.value).filter((one) => one.task.state !== "done").length);
const board = computed(() => ({ label: "Tasks", value: BOARD, count: open.value }));
const toBoard = (): void => void navigateTo("/desk");

const faces = computed(() => [
  ...chrome.view.faces.value.map((face) => ({ label: LABELS[face], value: face })),
  board.value,
]);

const task = $task();
const taskFaces = computed(() => [
  { label: "Document", value: "document" as const },
  { label: "History", value: "history" as const, count: task.entries.filter((one) => one.kind !== "read").length },
  board.value,
]);
const taskFace = computed<TaskFace | Board>({
  get: () => (route.query.face === "history" ? "history" : "document"),
  set: (next) => {
    if (next === BOARD) return toBoard();
    void navigateTo({ query: { ...route.query, face: next === "history" ? "history" : undefined } });
  },
});

const face = computed<Face | Board>({
  get: () => chrome.view.current.value,
  set: (next) => (next === BOARD ? toBoard() : chrome.view.set(next)),
});

// Replaced on close so Back never walks through it.
const closePage = (): void => {
  void navigateTo(`/c/${String(route.params.key ?? "")}`, { replace: true });
};
</script>

<template>
  <div class="top-right" data-region="top-right">
    <UiSurface v-if="onFaces" v-island-pop="'top right'" class="pill" pad="none" shape="pill" variant="glass-liquid">
      <UiSegmented v-model="face" data-region="view-switcher" :options="faces" variant="bare" />
    </UiSurface>

    <UiSurface v-if="onTask" v-island-pop="'top right'" class="pill" pad="none" shape="pill" variant="glass-liquid">
      <UiSegmented v-model="taskFace" data-region="task-face" :options="taskFaces" variant="bare" />
    </UiSurface>

    <ChromeAction
      v-if="elsewhere"
      data-region="tasks-tab"
      :icon="ListChecks"
      label="Tasks"
      shape="island"
      tip="The Desk, on Tasks"
      @click="toBoard"
    />
    <ChromeCommentToggle v-if="onArtifact" shape="island" />
    <ChromeFollowToggle v-if="inSession" />
    <TaskTerminalPill v-if="onTask" />
    <ChromeThemeToggle />
    <ChromeAction
      v-if="onArtifact"
      data-region="artifact-close"
      :icon="X"
      shape="island"
      tip="Close the page"
      @click="closePage"
    />
  </div>
</template>

<style scoped>
.top-right {
  @apply flex flex-none items-center gap-2;
}

.pill {
  @apply island-row px-1.5;
}
</style>
