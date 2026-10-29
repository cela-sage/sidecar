<script lang="ts" setup>
import { useNow } from "@vueuse/core";

const sc = useSidecar();
const usage = $usage();
const prompt = $prompt();
const terminal = $terminal();
const now = useNow({ interval: 30_000 });

const rows = computed(() => Usage.rows(usage.limits, now.value.getTime()));
const note = computed(() => Usage.note(rows.value, now.value.getTime()));
const sonnet = SessionModels.current.find((one) => one.name.startsWith("Sonnet"));

const widthOf = (percent: number): string => `${Math.min(percent, 100)}%`;

const switchModel = async (): Promise<void> => {
  const key = sc.sessionKey.value;
  if (sonnet && key && (await prompt.pick(sonnet.id))) void terminal.attach(key);
};
</script>

<template>
  <section v-if="rows.length" class="plan" aria-label="Plan usage, every project">
    <div v-for="row in rows" :key="row.kind" class="row" :data-tip="`${row.name} window, every project`">
      <div class="head">
        <span class="label">{{ row.label }}</span>
        <span class="reset">{{ Usage.reset(row, now.getTime()) }}</span>
        <span class="percent">{{ row.percent }}%</span>
      </div>
      <span class="bar" aria-hidden="true">
        <span class="used" :style="{ width: widthOf(row.percent) }" />
        <span v-if="row.hitsAt" class="ahead" :style="{ left: widthOf(row.percent) }" />
      </span>
    </div>
    <div v-if="note" class="note">
      <span class="words">{{ note.text }}</span>
      <UiButton
        v-if="note.isPace && sonnet && sc.sessionKey.value"
        size="xs"
        variant="outline"
        :data-tip="`Switches this conversation to ${sonnet.name}`"
        @click="switchModel"
      >
        Use {{ sonnet.name }} here
      </UiButton>
    </div>
  </section>
</template>

<style scoped>
.plan {
  @apply flex flex-none flex-col gap-2.5 border-t border-border px-3.5 pt-3 pb-3.5;
}

.row {
  @apply flex min-w-0 flex-col gap-1.5;
}

.head {
  @apply flex min-w-0 items-baseline gap-2;
}

.label {
  @apply flex-none typo-mono-micro font-mono font-semibold tracking-wider text-muted;
}

.reset {
  @apply min-w-0 flex-1 truncate typo-caption font-medium text-subtle;
}

.percent {
  @apply flex-none typo-mono-meta font-semibold text-fg;
}

.bar {
  @apply relative block h-1.25 rounded-full bg-sunken inset-ring inset-ring-border;
}

.used {
  @apply absolute inset-y-0 left-0 rounded-full bg-fg;
}

.ahead {
  @apply absolute inset-y-0 right-0 box-border rounded-r-full border border-l-0 border-dashed border-fg;
}

.note {
  @apply flex flex-col gap-2 rounded-xl bg-sunken px-2.75 py-2.5;
}

.words {
  @apply typo-caption leading-snug text-fg;
}

.note > :deep(.button) {
  @apply self-start;
}
</style>
