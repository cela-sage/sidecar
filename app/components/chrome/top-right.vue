<script lang="ts" setup>
import { ListTree, X } from "@lucide/vue";

type ConversationFace = Exclude<Face, "tasks">;

const route = useRoute();
const chrome = useChrome();
const sc = useSidecar();
const task = $task();
const desk = $desk();
const events = useEvents();

const LABELS: Record<ConversationFace, string> = {
  artifacts: "Artifacts",
  files: "Files",
  history: "History",
  review: "Review",
};

// With the server down every route shows the reconnecting screen, which has nothing to switch.
const inSession = computed(() => !sc.failure.value && route.path.startsWith("/c/"));
// A routed artifact has no faces to switch; a grown one keeps the row as it was, so the row fades out and back unchanged.
const onArtifact = computed(() => inSession.value && !!route.params.slug);
const onFaces = computed(() => inSession.value && !onArtifact.value && chrome.view.faces.value.length > 0);
const onTasks = computed(() => onFaces.value && chrome.view.current.value === "tasks");

const tasks = computed(() => Tasks.of(sc.catalogue.value));
const open = computed(() => tasks.value.filter((one) => one.task.state !== "done").length);
const needsYou = computed(() => desk.asks.length > 0 || tasks.value.some((one) => one.task.state === "blocked"));

const faces = computed(() =>
  chrome.view.faces.value
    .filter((face): face is ConversationFace => face !== "tasks")
    .map((face): { label: string; value: Face } => ({ label: LABELS[face], value: face })),
);

const face = computed<Face>({
  get: () => chrome.view.current.value,
  set: (next) => chrome.view.set(next),
});

// Replaced on close so Back never walks through it.
const closePage = (): void => {
  void navigateTo(`/c/${String(route.params.key ?? "")}`, { replace: true });
};

onMounted(() => void desk.load());
events.on("task.escalated", () => void desk.load());
events.on("task.decided", () => void desk.load());
</script>

<template>
  <div class="top-right" data-region="top-right">
    <UiSurface v-if="onFaces" v-island-pop="'top right'" class="pill" pad="none" shape="pill" variant="glass-liquid">
      <UiSegmented v-model="face" data-region="view-switcher" :options="faces" variant="bare" />
    </UiSurface>

    <UiSurface
      v-if="!sc.failure.value && !onArtifact"
      v-island-pop="'top right'"
      class="pill"
      pad="none"
      shape="pill"
      variant="glass-liquid"
    >
      <button
        class="tasks plain-button focusable"
        data-region="tasks-tab"
        type="button"
        :aria-pressed="onTasks"
        :data-tip="needsYou ? 'Every task and who is on it · a task needs you' : 'Every task and who is on it'"
        @click="task.show()"
      >
        <UiIcon :icon="ListTree" size="xs" />Tasks<span class="count">{{ open }}</span>
        <OrgMark v-if="needsYou" mark="needs" />
      </button>
    </UiSurface>

    <ChromeCommentToggle v-if="onArtifact" shape="island" />
    <ChromeFollowToggle v-if="inSession" />
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

.tasks {
  @apply inline-flex h-8 items-center gap-1.75 rounded-full border-0 bg-transparent px-2.5 typo-caption font-semibold text-muted transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-out;
}

.tasks[aria-pressed="true"] {
  @apply bg-raised text-fg shadow-sm;
}

@media (hover: hover) and (pointer: fine) {
  .tasks:not([aria-pressed="true"]):hover {
    @apply text-fg;
  }
}

.count {
  @apply typo-mono-micro font-medium text-muted;
}
</style>
