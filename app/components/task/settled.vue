<script lang="ts" setup>
import { Check } from "@lucide/vue";
import type { ReviewThread } from "~~/shared/types/artifact";

const { thread } = defineProps<{ thread: ReviewThread }>();
const emit = defineEmits<{ history: [] }>();

const decision = computed(() => thread.ask?.decision);
const byYou = computed(() => decision.value?.who === "YOU");
const at = computed(() =>
  decision.value ? new Date(decision.value.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
);
</script>

<template>
  <div v-if="decision" class="row" role="status" data-region="task-settled">
    <UiIcon class="check" :icon="Check" size="xs" />
    <span class="who">{{ byYou ? "Settled by you" : "Settled by the Project Lead" }}</span>
    <span class="when mono-meta">{{ at }}{{ byYou ? "" : " · within its reach" }}</span>
    <span class="said">{{ decision.text }}</span>
    <button class="link plain-button focusable" type="button" @click="emit('history')">
      {{ byYou ? "See it in the history" : "Read it" }}
    </button>
  </div>
</template>

<style scoped>
.row {
  @apply box-border flex min-h-11 items-center gap-2.5 rounded-xl border border-border-strong bg-sunken px-3.5;
}

.check {
  @apply flex-none text-fg;
}

.who {
  @apply flex-none typo-body font-bold;
}

.when {
  @apply flex-none text-muted normal-case;
}

.said {
  @apply min-w-0 flex-1 truncate typo-body text-muted;
}

.link {
  @apply flex-none typo-caption-strong text-fg underline underline-offset-3;
}
</style>
