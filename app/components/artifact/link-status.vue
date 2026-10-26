<script lang="ts" setup>
const TAIL = 28;

const artifact = $artifact();

const parts = computed(() => {
  const link = artifact.link ?? "";
  const cut = Math.max(Math.ceil(link.length / 2), link.length - TAIL);
  return { head: link.slice(0, cut), tail: link.slice(cut) };
});
</script>

<template>
  <Transition name="status">
    <div v-if="artifact.link" class="status" data-region="link-status" role="status">
      <span class="head">{{ parts.head }}</span>
      <span class="tail">{{ parts.tail }}</span>
    </div>
  </Transition>
</template>

<style scoped>
/* The head gives way first and the tail never does, so a long link is cut in the middle with its file name in view. */
.status {
  @apply pointer-events-none absolute bottom-[calc(var(--float-clear,0px)_+_--spacing(2))] left-2 z-29 flex max-w-[min(--spacing(150),calc(100%_-_--spacing(4)))] rounded-field border border-border bg-raised px-2 py-1 font-mono typo-meta-strong whitespace-pre text-muted shadow-sm;
}

.head {
  @apply min-w-0 truncate;
}

.tail {
  @apply flex-none;
}

.status-enter-active {
  @apply transition-opacity delay-(--duration-fast) duration-(--duration-fast) ease-out;
}

.status-leave-active {
  @apply transition-opacity duration-(--duration-fast) ease-out;
}

.status-enter-from,
.status-leave-to {
  @apply opacity-0;
}

@media (prefers-reduced-motion: reduce) {
  .status-enter-active,
  .status-leave-active {
    @apply transition-none;
  }
}
</style>
