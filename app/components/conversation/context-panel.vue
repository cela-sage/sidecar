<script lang="ts" setup>
const { isBusy } = defineProps<{ isBusy: boolean }>();
const emit = defineEmits<{ done: [] }>();

const sc = useSidecar();
const usage = $usage();
const focus = ref("");

const key = computed(() => sc.sessionKey.value ?? "");
const breakdown = computed(() => usage.front?.breakdown);
const parts = computed(() =>
  (breakdown.value?.parts ?? []).map((part) => ({
    ...part,
    width: `${(part.tokens / (breakdown.value?.window ?? 1)) * 100}%`,
  })),
);
const total = computed(() =>
  breakdown.value
    ? `${Usage.kilo(breakdown.value.tokens)} of ${Usage.kilo(breakdown.value.window)} · ${SessionModels.nameOf(breakdown.value.model)}`
    : "",
);
const free = computed(() => Math.max(0, (breakdown.value?.window ?? 0) - (breakdown.value?.tokens ?? 0)));
const note = computed(() => {
  if (usage.isCompacting) return "Summarizing the conversation";
  if (isBusy) return "Claude is working. Compact once it stops.";
  if (focus.value.trim()) return "Compact keeps what you name here";
  const at = breakdown.value?.autoCompactPercent;
  return at ? `Compacts by itself at ${at}%` : "";
});

const compact = (): void => {
  if (!isBusy) void usage.compact(key.value, focus.value);
};

onMounted(() => usage.read(key.value));
onBeforeUnmount(() => usage.release(key.value));

watch(
  () => usage.isCompacting,
  (now, before) => {
    if (before && !now) emit("done");
  },
);
</script>

<template>
  <div class="panel" role="dialog" aria-label="Context">
    <div class="head">
      <span class="title">Context</span>
      <span class="total">{{ total }}</span>
    </div>
    <p v-if="!breakdown" class="quiet">Reading the context</p>
    <template v-else>
      <div class="bar" aria-hidden="true">
        <span
          v-for="(part, at) in parts"
          :key="part.label"
          class="segment"
          :data-shade="at"
          :style="{ width: part.width }"
        />
      </div>
      <div class="rows">
        <div v-for="(part, at) in parts" :key="part.label" class="line">
          <span class="swatch" :data-shade="at" aria-hidden="true" />
          <span class="name">{{ part.label }}</span>
          <span class="size">{{ Usage.kilo(part.tokens) }}</span>
        </div>
        <div class="line" data-free="true">
          <span class="swatch" aria-hidden="true" />
          <span class="name">Free</span>
          <span class="size">{{ Usage.kilo(free) }}</span>
        </div>
      </div>
    </template>
    <label class="focus">
      <span class="focus-label mono-meta">Focus the summary on</span>
      <UiTextarea
        v-model="focus"
        auto-fit
        :disabled="usage.isCompacting"
        :max-rows="3"
        placeholder="What the summary should keep"
        :rows="1"
      />
    </label>
    <div class="foot">
      <span class="note" :class="{ shimmer: usage.isCompacting }">{{ note }}</span>
      <UiButton v-if="usage.isCompacting" data-tip="Stop · {esc}" size="xs" variant="outline" @click="usage.stop(key)">
        Stop
      </UiButton>
      <button
        v-else
        class="compact plain-button focusable"
        :aria-disabled="isBusy"
        :data-tip="
          isBusy
            ? 'Compact · /compact, once Claude stops'
            : focus.trim()
              ? 'Compact · /compact with your focus'
              : 'Compact · /compact'
        "
        type="button"
        @click="compact"
      >
        Compact
      </button>
    </div>
  </div>
</template>

<style scoped>
.panel {
  @apply flex flex-col gap-3 p-3.5;
}

.head {
  @apply flex items-baseline justify-between gap-2;
}

.title {
  @apply typo-body-strong;
}

.total {
  @apply typo-mono-micro text-muted;
}

.quiet {
  @apply m-0 typo-caption text-subtle;
}

.bar {
  @apply flex h-2 gap-0.5 overflow-hidden rounded-full bg-sunken;
}

.segment {
  @apply flex-none;
}

.rows {
  @apply flex flex-col gap-1.5;
}

.line {
  @apply flex items-center gap-2 typo-caption;
}

.swatch {
  @apply size-2 flex-none rounded-xs;
}

.name {
  @apply flex-1 text-fg;
}

.size {
  @apply typo-mono-meta text-muted;
}

.line[data-free="true"] .swatch {
  @apply box-border border border-border-strong bg-sunken;
}

.line[data-free="true"] .name {
  @apply text-muted;
}

[data-shade="0"] {
  @apply bg-fg/85;
}

[data-shade="1"] {
  @apply bg-fg/55;
}

[data-shade="2"] {
  @apply bg-fg/35;
}

[data-shade="3"] {
  @apply bg-fg/20;
}

.focus {
  @apply flex flex-col gap-1.5;
}

.focus-label {
  @apply text-subtle;
}

.foot {
  @apply flex items-center gap-2.5 border-t border-border pt-2.5;
}

.note {
  @apply min-w-0 flex-1 typo-caption leading-snug text-balance text-muted;
}

.compact {
  @apply h-7 flex-none cursor-pointer rounded-full border-0 bg-fg px-3.25 typo-caption-strong text-canvas transition-opacity duration-(--duration-fast) ease-out;
}

.compact[aria-disabled="true"] {
  @apply cursor-not-allowed border border-border bg-sunken text-subtle;
}
</style>
