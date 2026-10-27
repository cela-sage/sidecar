<script lang="ts" setup>
import { useIntervalFn } from "@vueuse/core";
import { Titles } from "~~/shared/utils/titles";

const CATALOGUE_MS = 5000;

const route = useRoute();
const sc = useSidecar();
const task = $task();
const events = useEvents();

const slug = computed(() => String(route.params.task ?? ""));
const meta = computed(() => Tasks.of(sc.catalogue.value).find((one) => one.slug === slug.value));
const project = computed(() => task.projects.find((one) => one.key === meta.value?.task.project));
const title = computed(() => meta.value?.title || deslug(slug.value));
const isHistory = computed(() => route.query.face === "history");

const rail = computed(() => Tasks.railOf(sc.sessions.value, slug.value));

// Notes on the document go to whoever runs it, and with nobody on it yet to the conversation already in front.
const conversation = computed(() => {
  const lead = meta.value?.task.lead;
  const oldest = [...rail.value].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const held =
    oldest.find((session) => nameOf(session) === lead) ??
    oldest.find((session) => Titles.parse(nameOf(session))?.role === "TL") ??
    oldest[0];
  return held?.key ?? sc.sessionKey.value;
});

function heard({ data }: { data: { slug: string } }): void {
  if (data.slug !== slug.value) return;
  void task.refresh();
  void task.readTasks();
}

loadSidecar();
void task.loadProjects();
watch(slug, (next) => void task.open(next), { immediate: true });
events.on("task.changed", heard);
events.on("task.escalated", heard);
events.on("task.decided", heard);

// A stamp changes with no event when Mode's own CLI writes it, so the board reads the catalogue again while it is open.
useIntervalFn(task.readTasks, CATALOGUE_MS);
</script>

<template>
  <NuxtLayout>
    <template #lead>
      <ChromeHead :cwd="project?.folder" :title="title" />
    </template>

    <template #dock>
      <ComposerNotes />
    </template>

    <main class="stage" data-region="task-stage">
      <template v-if="meta && isHistory">
        <TaskHistory :meta="meta" />
        <TaskEntry :meta="meta" />
      </template>
      <template v-else>
        <TaskSidebar :current="slug" />
        <TaskSheet v-if="meta" :conversation="conversation" :meta="meta" :project="project" :rail="rail" />
        <UiSurface v-else class="missing" pad="none" variant="raised">
          <UiStateMessage v-if="!sc.ready.value" align="center" kind="loading">Reading the tasks…</UiStateMessage>
          <UiStateMessage v-else align="center">
            <b>{{ slug }}</b> is not a task. A task is a .md whose stamp holds a state.
          </UiStateMessage>
        </UiSurface>
      </template>
    </main>
  </NuxtLayout>
</template>

<style scoped>
.stage {
  @apply absolute inset-0 grid grid-cols-[--spacing(85)_minmax(0,1fr)] gap-x-4 overflow-hidden px-(--gutter) pt-(--stage-top) pb-(--gutter);
  --float-clear: calc(max(var(--dock-h, 0px), var(--island-row-h)) + var(--gutter));
}

.missing {
  @apply grid min-h-0 place-items-center p-4;
}
</style>
