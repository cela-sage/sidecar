<script lang="ts" setup>
import { ArrowUp } from "@lucide/vue";
import type { DockTab } from "~~/shared/types/dock";

const { lines, tab } = defineProps<{ lines: string[]; tab: DockTab }>();

const prompt = $prompt();

const send = (): void => prompt.attach({ label: `${tab.title} failed`, text: lines.join("\n") });
</script>

<template>
  <section class="failure" data-region="run-failure" :aria-label="`Where ${tab.title} failed`">
    <pre class="lines">{{ lines.join("\n") }}</pre>
    <UiButton class="send" data-tip="Adds these lines to the prompt" size="xs" @click="send">
      <UiIcon :icon="ArrowUp" size="xs" />Send to Claude
    </UiButton>
  </section>
</template>

<style scoped>
/* Above the screen, because the door's pill floats over the dock's bottom right. */
.failure {
  @apply relative mx-2 mt-2 max-h-2/5 flex-none overflow-auto rounded-lg bg-error-soft px-2 py-1;
}

.lines {
  @apply m-0 pr-32 typo-mono-meta whitespace-pre text-fg;
}

.send {
  @apply absolute top-1.5 right-2;
}
</style>
