<script lang="ts" setup>
import { X } from "@lucide/vue";

const route = useRoute();
const sc = useSidecar();
const chrome = useChrome();

const key = computed(() => String(route.params.key ?? ""));
const slug = computed(() => String(route.params.slug ?? ""));
const title = computed(() => sc.artifact.value?.title || deslug(slug.value));
const isWeb = computed(() => sc.artifact.value?.slug === slug.value && sc.artifact.value.kind === "web");

loadSidecar();

// `shelved` follows the conversation's face, and this route has no face to follow.
watchEffect(() => {
  chrome.islands.shelved.value = false;
});

// Replaced on close so Back never walks through it.
const close = (): void => {
  void navigateTo(`/c/${key.value}`, { replace: true });
};
</script>

<template>
  <NuxtLayout>
    <template #dock>
      <ComposerNotes />
    </template>

    <main class="stage" :data-web="isWeb">
      <WebReader v-if="isWeb" :conversation="key" :slug="slug" />
      <ArtifactReader v-else :conversation="key" :slug="slug">
        <template #blank>
          <UiButton class="back" size="xs" :to="`/c/${key}`" variant="outline">Back to the conversation</UiButton>
        </template>
      </ArtifactReader>
    </main>

    <div class="row" data-region="island-row">
      <ArtifactHead :title="title" />
      <span class="spacer" />
      <ChromeCommentToggle shape="island" />
      <ChromeAction data-region="artifact-close" :icon="X" shape="island" tip="Close the page" @click="close" />
    </div>
  </NuxtLayout>
</template>

<style scoped>
/* The page owns the scroll — the frame inside it is sized to its content and never scrolls itself. */
.stage {
  @apply absolute inset-0 overflow-y-auto px-0 pt-(--stage-top) pb-[calc(var(--dock-h,var(--dock-rest-h))_+_var(--gutter)_*_2)];
}

/* A live page scrolls itself, so the stage only holds it. */
.stage[data-web="true"] {
  @apply flex overflow-hidden;
}

.back {
  @apply mt-3.5;
}

.row {
  @apply pointer-events-none absolute top-(--gutter) right-(--gutter) left-(--gutter) z-30 flex items-center gap-2;
}

.row > * {
  @apply pointer-events-auto;
}

.row > .spacer {
  @apply pointer-events-none flex-1;
}
</style>
