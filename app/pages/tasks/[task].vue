<script lang="ts" setup>
const route = useRoute();

useTasksRedirect(String(route.params.task ?? ""));
</script>

<template>
  <NuxtLayout />
</template>
