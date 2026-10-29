<script lang="ts" setup>
loadSidecar();
$follow().listen({ isEager: true });
</script>

<template>
  <NuxtLayout>
    <main class="main">
      <ListeningScreen />
    </main>
  </NuxtLayout>
</template>

<style scoped>
.main {
  @apply absolute inset-0 overflow-hidden;
}
</style>
