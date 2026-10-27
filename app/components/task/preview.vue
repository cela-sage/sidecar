<script lang="ts" setup>
import { useDebounceFn } from "@vueuse/core";

const { slug, text } = defineProps<{ slug: string; text: string }>();

const RENDER_MS = 250;

const look = useTheme();
const frame = useTemplateRef<HTMLIFrameElement>("frame");
const html = ref<string>();
let scroll = 0;
let ticket = 0;

const render = useDebounceFn(async (): Promise<void> => {
  const mine = ++ticket;
  const page = await $fetch<string>(`/api/artifacts/${encodeURIComponent(slug)}/render`, {
    body: { text },
    method: "POST",
    responseType: "text",
  }).catch(() => undefined);
  if (mine !== ticket || !page) return;
  scroll = frame.value?.contentWindow?.scrollY ?? scroll;
  html.value = page;
}, RENDER_MS);

function onLoad(): void {
  const doc = frame.value?.contentDocument;
  doc?.documentElement.setAttribute("data-theme", look.theme.value);
  frame.value?.contentWindow?.scrollTo(0, scroll);
}

watch(() => text, render, { immediate: true });
watch(look.theme, (theme) => frame.value?.contentDocument?.documentElement.setAttribute("data-theme", theme));
</script>

<template>
  <div class="preview" data-region="task-preview">
    <iframe
      v-if="html"
      ref="frame"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      :srcdoc="html"
      :title="`Preview of ${slug}`"
      @load="onLoad"
    />
    <UiStateMessage v-else align="center" class="pending" kind="loading">Rendering the draft…</UiStateMessage>
  </div>
</template>

<style scoped>
.preview {
  @apply relative flex min-h-0 min-w-0 flex-col;
}

iframe {
  @apply block min-h-0 w-full flex-1 border-0;
}

.pending {
  @apply flex-1 p-4;
}
</style>
