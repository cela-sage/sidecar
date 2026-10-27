<script lang="ts" setup>
import { useIntervalFn } from "@vueuse/core";
import type { ArtifactMeta } from "~~/shared/types/artifact";

const CATALOGUE_MS = 5000;

const route = useRoute();
const sc = useSidecar();
const task = $task();

const slug = computed(() => String(route.params.task ?? ""));
const meta = computed(() => Tasks.of(sc.catalogue.value).find((one) => one.slug === slug.value));
const project = computed(() => task.projects.find((one) => one.key === meta.value?.task.project));
const title = computed(() => meta.value?.title || deslug(slug.value));

const rail = computed(() =>
  sc.sessions.value
    .filter((session) => {
      const titled = (!session.archived || session.live) && Tasks.parseTitle(nameOf(session));
      return !!titled && Tasks.belongsTo(titled, slug.value);
    })
    .sort(Tasks.agentOrder),
);

// Notes on the document go to whoever runs it, and with nobody on it yet to the conversation already in front.
const conversation = computed(() => {
  const lead = meta.value?.task.lead;
  const oldest = [...rail.value].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const held =
    oldest.find((session) => nameOf(session) === lead) ??
    oldest.find((session) => Tasks.parseTitle(nameOf(session))?.role === "TL") ??
    oldest[0];
  return held?.key ?? sc.sessionKey.value;
});

loadSidecar();
void task.loadProjects();

// A stamp changes with no event, so the board reads the catalogue again while it is open.
useIntervalFn(async () => {
  sc.catalogue.value = await $fetch<ArtifactMeta[]>("/api/artifacts").catch(() => sc.catalogue.value);
}, CATALOGUE_MS);
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
      <TaskSidebar :current="slug" />
      <TaskSheet v-if="meta" :conversation="conversation" :meta="meta" :project="project" :rail="rail" />
      <UiSurface v-else class="missing" pad="none" variant="raised">
        <UiStateMessage v-if="!sc.ready.value" align="center" kind="loading">Reading the tasks…</UiStateMessage>
        <UiStateMessage v-else align="center">
          <b>{{ slug }}</b> is not a task. A task is a .md whose stamp holds a state.
        </UiStateMessage>
      </UiSurface>
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
