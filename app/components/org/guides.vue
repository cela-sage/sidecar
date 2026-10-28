<script lang="ts" setup>
const { depth } = defineProps<{ depth: number }>();
</script>

<template>
  <span v-for="level in depth" :key="level" class="guide" aria-hidden="true" :data-level="level" />
</template>

<style scoped>
.guide {
  @apply absolute -top-0.5 -bottom-px w-px origin-left scale-x-50 bg-border;
}

.guide[data-level="1"] {
  @apply left-2.25;
}

.guide[data-level="2"] {
  @apply left-10;
}

.guide[data-level="3"] {
  @apply left-17;
}

.guide[data-level="4"] {
  @apply left-24;
}
</style>
