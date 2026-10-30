<script lang="ts" setup>
import { Titles } from "~~/shared/utils/titles";

const sc = useSidecar();
const task = $task();

const meta = computed(() => Tasks.of(sc.catalogue.value).find((one) => one.slug === task.slug));
const project = computed(() => task.projects.find((one) => one.key === meta.value?.task.project));
const rail = computed(() => (meta.value ? Tasks.railOf(sc.sessions.value, meta.value.slug) : []));

// Notes on the document go to whoever runs it, and with nobody on it yet to the conversation already in front.
const conversation = computed(() => {
  const lead = meta.value?.task.lead;
  const oldest = [...rail.value].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const held =
    oldest.find((session) => nameOf(session) === lead) ??
    oldest.find((session) => Titles.parse(nameOf(session))?.role === "IC") ??
    oldest[0];
  return held?.key ?? sc.sessionKey.value;
});
</script>

<template>
  <section class="front" data-region="task-front">
    <TaskSheet v-if="meta" class="sheet" :conversation="conversation" :meta="meta" :project="project" :rail="rail" />
    <UiSurface v-else class="missing" pad="none" variant="raised">
      <UiStateMessage align="center">This task is not in the catalogue.</UiStateMessage>
    </UiSurface>
  </section>
</template>

<style scoped>
.front {
  @apply absolute inset-0 flex;
}

.sheet {
  @apply flex-1;
}

.front :deep(.slot > [data-surface="raised"]:not([data-expanded="true"])) {
  @apply rounded-none border-0 shadow-none;
}

.missing {
  @apply flex flex-1 items-center justify-center;
}
</style>
