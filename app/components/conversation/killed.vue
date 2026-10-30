<script lang="ts" setup>
const { reason } = defineProps<{ reason: string }>();

const sc = useSidecar();
const life = $life();
</script>

<template>
  <div class="killed" role="status">
    <span class="reason">{{ reason }}</span>
    <UiButton
      :disabled="life.isResuming"
      size="xs"
      variant="primary"
      @click="sc.sessionKey.value && life.resume(sc.sessionKey.value)"
    >
      {{ life.isResuming ? "Resuming" : "Resume" }}
    </UiButton>
  </div>
</template>

<style scoped>
.killed {
  @apply flex items-center justify-between gap-3 p-3.5;
}

.reason {
  @apply min-w-0 typo-caption text-muted;
}
</style>
