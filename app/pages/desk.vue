<script lang="ts" setup>
import { ArrowLeft } from "@lucide/vue";
import type { DeskRow } from "~/composables/useDesk";

type DeskFace = "tasks" | "conversations";

const sc = useSidecar();
const chrome = useChrome();
const router = useRouter();
const route = useRoute();

loadSidecar();

const open = computed(() => Tasks.of(sc.catalogue.value).filter((one) => one.task.state !== "done").length);
const faces = computed(() => [
  { label: "Tasks", value: "tasks" as const, count: open.value },
  { label: "Conversations", value: "conversations" as const },
]);
const face = computed<DeskFace>({
  get: () => (route.query.face === "conversations" ? "conversations" : "tasks"),
  set: (next) =>
    void navigateTo(
      { query: { ...route.query, face: next === "conversations" ? next : undefined } },
      { replace: true },
    ),
});

const openConversation = (key: string): void => {
  sc.sessionKey.value = key;
  void navigateTo(`/c/${key}`);
};

// A desk opened cold has nothing behind it, so Back lands on Listening instead of leaving the app.
const back = (): void => {
  if (window.history.state?.back) router.back();
  else void navigateTo("/", { replace: true });
};

const remove = async (row: DeskRow): Promise<void> => {
  try {
    await $fetch(`/api/sessions/${row.key}`, { method: "DELETE" });
    sc.sessions.value = sc.sessions.value.filter((session) => session.key !== row.key);
    chrome.toast(`Deleted ${row.title}. Its transcript stays on disk.`, "success");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    chrome.toast(`Could not delete ${row.title}. ${reason}`, "destructive");
  }
};
</script>

<template>
  <NuxtLayout>
    <template #lead>
      <ChromeAction data-region="desk-back" :icon="ArrowLeft" shape="island" tip="Back · {esc}" @click="back" />
      <UiSurface v-island-pop="'top'" class="switch" pad="none" shape="pill" variant="glass-liquid">
        <UiSegmented v-model="face" data-region="desk-face" :options="faces" variant="bare" />
      </UiSurface>
    </template>

    <DeskTasks v-if="face === 'tasks'" @back="back" />
    <DeskTriage v-else @back="back" @open="openConversation" @remove="remove" />
  </NuxtLayout>
</template>

<style scoped>
.switch {
  @apply absolute left-1/2 island-row -translate-x-1/2 px-1.5;
}
</style>
