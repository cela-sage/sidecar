<script lang="ts" setup>
import { useIntervalFn } from "@vueuse/core";
import { Titles } from "~~/shared/utils/titles";

const READ_MS = 5000;

const sc = useSidecar();
const task = $task();
const desk = $desk();
const events = useEvents();
const shown = useFaceShown();
const picked = useConversationPick("ar:picks");

const meta = computed(() => Tasks.of(sc.catalogue.value).find((one) => one.slug === task.slug));
const project = computed(() => task.projects.find((one) => one.key === meta.value?.task.project));
const rail = computed(() => (meta.value ? Tasks.railOf(sc.sessions.value, meta.value.slug) : []));
const page = computed(() => sc.catalogue.value.find((one) => one.slug === picked.value));

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

const read = (): void => {
  void desk.load();
  void task.readTasks();
};

const heard = ({ data }: { data: { slug: string } }): void => {
  read();
  if (data.slug === task.slug) void task.refresh();
};

void task.loadProjects();
read();
events.on("task.changed", heard);
events.on("task.escalated", heard);
events.on("task.decided", heard);

// A stamp changes with no event when Mode's own CLI writes it, so the face reads the catalogue again while it shows.
useIntervalFn(() => shown.value && read(), READ_MS);
</script>

<template>
  <section class="tasks" data-region="tasks">
    <OrgTree />
    <TaskSheet v-if="meta" :conversation="conversation" :meta="meta" :project="project" :rail="rail" />
    <ArtifactSheet v-else :conversation="sc.sessionKey.value" :kind="page?.kind" :path="page?.path" :slug="page?.slug">
      <UiStateMessage align="center" class="centered">Pick a task in the tree, or a page in Artifacts.</UiStateMessage>
    </ArtifactSheet>
  </section>
</template>

<style scoped>
.tasks {
  @apply grid h-full min-h-0 grid-cols-[--spacing(85)_minmax(0,1fr)] gap-x-4;
}

.centered {
  @apply flex-1 p-4;
}
</style>
