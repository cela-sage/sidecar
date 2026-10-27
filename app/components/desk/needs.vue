<script lang="ts" setup>
import { ArrowRight } from "@lucide/vue";
import type { DeskAsk } from "~~/shared/types/desk";

const { active, ask, project } = defineProps<{ active?: string; ask: DeskAsk; project?: string }>();

const age = computed(() => relativeAge(ask.at));
const waits = computed(() => (ask.kind === "hire" ? "A hire waits on your approval" : "Waiting on your decision"));
</script>

<template>
  <UiSurface
    :id="`desk-ask-${ask.thread}`"
    class="needs"
    data-region="desk-needs"
    :data-active="ask.slug === active"
    pad="none"
    variant="raised"
  >
    <div class="what">
      <div class="head">
        <span class="dot" />
        <span class="title">{{ ask.title }}</span>
        <span class="where mono-meta">{{ [project ?? "Inbox", age].filter(Boolean).join(" · ") }}</span>
      </div>
      <div class="body">
        <span class="waits mono-meta">{{ waits }}</span>
        <span class="question">{{ ask.question }}</span>
      </div>
    </div>
    <UiButton data-tip="Open the escalation on the task" :to="`/tasks/${ask.slug}`" size="sm" variant="secondary"
      >Decide<UiIcon :icon="ArrowRight" size="sm"
    /></UiButton>
  </UiSurface>
</template>

<style scoped>
.needs {
  @apply flex items-end gap-4 rounded-2xl p-4;
}

.needs[data-active="true"] {
  @apply ring-2 ring-border-strong;
}

.what {
  @apply flex min-w-0 flex-1 flex-col gap-1.5;
}

.head {
  @apply flex items-center gap-2.5;
}

.dot {
  @apply dot size-2 flex-none bg-error;
}

.title {
  @apply min-w-0 flex-1 truncate typo-heading;
}

.where {
  @apply flex-none text-muted normal-case;
}

.body {
  @apply flex flex-col gap-1.5 pl-4.5;
}

.waits {
  @apply font-semibold text-error;
}

.question {
  @apply rounded-field bg-sunken px-2.5 py-2 typo-body leading-normal text-pretty text-fg;
}
</style>
