<template>
  <header class="bar" aria-label="This item" data-region="item-bar" role="toolbar">
    <span class="spacer" />
    <slot />
  </header>
</template>

<style scoped>
.bar {
  @apply flex h-11 flex-none items-center gap-1.5 border-b border-b-border bg-raised pr-2.5 pl-3;
}

/* Never :global() here: Vue's scoped compiler keeps only what is inside it, which made the whole shell the drag region. */
.shell[data-drags="true"] .bar {
  app-region: drag;
}

.shell[data-drags="true"] .bar > :not(.spacer) {
  app-region: no-drag;
}

.spacer {
  @apply min-w-4 flex-1;
}
</style>
