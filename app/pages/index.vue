<script lang="ts" setup>
loadSidecar();
$follow().listen({ isEager: true });
</script>

<template>
  <NuxtLayout>
    <UiSurface class="main" pad="none" variant="raised">
      <ListeningScreen />
    </UiSurface>
  </NuxtLayout>
</template>

<style scoped>
.main {
  @apply absolute inset-0 overflow-hidden;
}
</style>
