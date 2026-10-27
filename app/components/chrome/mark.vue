<template>
  <span class="mark" data-region="sidecar-mark">
    <span class="lights" aria-hidden="true" />
    <img class="icon" alt="Sidecar" src="/icons/sidecar.svg" />
  </span>
</template>

<style scoped>
.mark {
  @apply flex flex-none items-center gap-2.5;
}

.lights {
  @apply hidden h-3 w-13 flex-none;
}

:global(.shell[data-shell="true"]) .lights {
  @apply block;
}

.icon {
  @apply size-6 flex-none;
}
</style>
