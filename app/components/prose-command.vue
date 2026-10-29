<script lang="ts" setup>
const { command } = defineProps<{ command: string }>();
</script>

<template>
  <span class="command">
    <slot />
    <ProseRun class="run" :command="command" />
  </span>
</template>

<style scoped>
.command {
  @apply inline-flex items-center gap-0.5 align-middle;
}

.run {
  @apply -my-1;
}
</style>
