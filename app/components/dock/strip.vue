<script lang="ts" setup>
import { ChevronUp, Terminal } from "@lucide/vue";

const route = useRoute();
const dock = $dock();

const front = computed(() => dock.projectOf(String(route.params.key ?? "")));
const shells = computed(() => dock.tabsOf(front.value.key, "terminal").map((tab) => dock.labelOf(tab)));
const runs = computed(() => dock.tabsOf(front.value.key, "run"));
const run = computed(
  () => runs.value.find((one) => one.status === "failed") ?? runs.value.find((one) => one.status === "running"),
);
const failing = computed(() => (run.value?.status === "failed" ? run.value.failing?.[0] : undefined));
</script>

<template>
  <div
    v-if="!dock.isOpen"
    class="strip"
    data-region="dock-strip"
    role="toolbar"
    :aria-label="`Tool windows, ${front.name}`"
  >
    <button
      class="tool plain-button focusable"
      type="button"
      :data-tip="`Open ${front.name}'s shells`"
      @click="dock.open('terminal')"
    >
      <UiIcon :icon="Terminal" size="xs" />
      <span class="name">Terminal</span>
      <span v-if="dock.isReady" class="holds">{{ shells.join(" · ") || "no shells" }}</span>
    </button>

    <span class="rule" aria-hidden="true" />

    <button
      class="tool plain-button focusable"
      type="button"
      :data-tip="failing ? 'Open the failed run' : `Open ${front.name}'s runs`"
      @click="dock.open('run', run)"
    >
      <RunStatusMark :status="run?.status" />
      <span class="name">Run</span>
      <span v-if="dock.isReady" class="holds">{{ run ? `${run.title} · ${run.status}` : "nothing running" }}</span>
    </button>
    <span v-if="failing" class="line" data-tip="The line that names the failure">{{ failing }}</span>

    <span class="spacer" />
    <UiIconButton
      :icon="ChevronUp"
      icon-size="xs"
      label="Show the dock"
      size="sm"
      tip="Show the dock · ⌥F12"
      @click="dock.toggle()"
    />
  </div>
</template>

<style scoped>
.strip {
  @apply flex h-8 flex-none items-center gap-0.5 border-t border-t-border pr-1.5 pl-2;
}

.tool {
  @apply inline-flex h-6 min-w-0 cursor-pointer items-center gap-1.75 rounded-lg border-0 bg-transparent pr-2.25 pl-2 text-muted transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .tool:hover {
    @apply bg-sunken text-fg;
  }
}

.name {
  @apply flex-none typo-caption-strong text-fg;
}

.holds {
  @apply truncate typo-mono-micro text-muted;
}

.rule {
  @apply mx-1 h-3.5 w-px flex-none bg-border;
}

.line {
  @apply min-w-0 truncate pl-0.5 typo-mono-micro text-muted;
}

.spacer {
  @apply flex-1;
}

@media (prefers-reduced-motion: reduce) {
  .tool {
    @apply transition-none;
  }
}
</style>
