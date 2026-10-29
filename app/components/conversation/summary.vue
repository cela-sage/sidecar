<script lang="ts" setup>
import { ChevronRight } from "@lucide/vue";

const { at, conversation, label } = defineProps<{ at: number; conversation: string; label: string }>();

const isOpen = ref(false);
const text = ref<string>();
const isMissing = ref(false);

const toggle = async (): Promise<void> => {
  isOpen.value = !isOpen.value;
  if (!isOpen.value || text.value) return;
  isMissing.value = false;
  try {
    const read = await $fetch<{ text: string }>(`/api/sessions/${encodeURIComponent(conversation)}/summary`, {
      query: { at },
    });
    text.value = read.text;
  } catch {
    isMissing.value = true;
  }
};
</script>

<template>
  <div class="summary" :data-open="isOpen">
    <button class="toggle plain-button mono-meta focusable" type="button" :aria-expanded="isOpen" @click="toggle">
      {{ label }}
      <UiIcon class="chevron" :icon="ChevronRight" size="xs" />
    </button>
    <template v-if="isOpen">
      <Prose v-if="text" class="body" :conversation="conversation" :value="text" />
      <p v-else-if="isMissing" class="quiet mono-meta">The summary is no longer in the transcript</p>
      <p v-else class="quiet mono-meta">Reading the summary</p>
    </template>
  </div>
</template>

<style scoped>
.summary {
  @apply flex flex-col items-center gap-2;
}

.toggle {
  @apply inline-flex items-center gap-1 border-0 bg-transparent p-0 text-subtle normal-case;
}

.chevron {
  @apply transition-transform duration-(--duration-fast) ease-out;
}

.summary[data-open="true"] .chevron {
  @apply rotate-90;
}

.body {
  @apply max-h-96 w-full overflow-y-auto rounded-2xl bg-sunken px-3.5 py-2.25 typo-body;
}

.quiet {
  @apply m-0 text-subtle normal-case;
}
</style>
