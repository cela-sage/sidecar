<script lang="ts" setup>
import { FileHeadphone, FileImage, FileText, FileVideoCamera } from "@lucide/vue";
import type { Component } from "vue";
import type { WebPage } from "~~/lib/web/page/protocol";
import type { ArtifactMeta } from "~~/shared/types/artifact";
import { FileKind } from "~~/shared/utils/file-kind";

const { meta, page } = defineProps<{
  meta: ArtifactMeta;
  /** The page on screen when this is the open entry, whose own icon wins for its site. */
  page?: WebPage;
}>();

const MEDIA: Partial<Record<FileKind, { icon: Component; tip: string }>> = {
  audio: { icon: FileHeadphone, tip: "Audio" },
  image: { icon: FileImage, tip: "Image" },
  pdf: { icon: FileText, tip: "PDF" },
  video: { icon: FileVideoCamera, tip: "Video" },
};

const media = computed(() => {
  const kind = FileKind.of(meta.path);
  return meta.format === "media" && kind ? MEDIA[kind] : undefined;
});
</script>

<template>
  <span v-if="meta.kind === 'web'" class="kind" data-tip="Web">
    <WebFavicon class="site" :address="meta.url ?? ''" :page="page" />
  </span>
  <span v-else-if="media" class="kind" :data-tip="media.tip">
    <UiIcon class="site" :icon="media.icon" size="sm" />
  </span>
  <span v-else-if="meta.format === 'ipynb'" class="kind" data-tip="Notebook">
    <svg aria-label="Notebook" class="mark" data-mark="ipynb" role="img" viewBox="0 0 16 16">
      <path d="M2.75 6.25a5.5 3.25 0 0 1 10.5 0" />
      <path d="M2.75 9.75a5.5 3.25 0 0 0 10.5 0" />
      <circle cx="12.5" cy="2.75" r="0.9" />
      <circle cx="3.25" cy="13.25" r="0.9" />
    </svg>
  </span>
  <span v-else-if="meta.format === 'md'" class="kind" data-tip="Markdown">
    <svg aria-label="Markdown" class="mark" data-mark="md" role="img" viewBox="0 0 16 16">
      <path d="M1.5 11.5v-7l3 3.5 3-3.5v7" />
      <path d="M12 4.5v7" />
      <path d="m9.75 9.25 2.25 2.25 2.25-2.25" />
    </svg>
  </span>
  <span v-else class="kind" data-tip="HTML page">
    <svg aria-label="HTML" class="mark" data-mark="html" role="img" viewBox="0 0 16 16">
      <path d="M5.5 4 1.5 8l4 4" />
      <path d="m10.5 4 4 4-4 4" />
    </svg>
  </span>
</template>

<style scoped>
.kind {
  @apply inline-flex flex-none;
}

.site {
  @apply text-muted;
}

.mark {
  @apply size-3.5 flex-none fill-none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mark[data-mark="md"] {
  @apply stroke-file-md;
  stroke-width: 1.6;
}

.mark[data-mark="html"] {
  @apply stroke-file-html;
  stroke-width: 1.8;
}

.mark[data-mark="ipynb"] {
  @apply stroke-file-ipynb;
  stroke-width: 1.7;
}

.mark[data-mark="ipynb"] circle {
  @apply fill-file-ipynb stroke-none;
}
</style>
