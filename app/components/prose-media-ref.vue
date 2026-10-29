<script lang="ts" setup>
const { path } = defineProps<{ path: string }>();

const links = useLinks();
</script>

<template>
  <a class="media-ref" data-tip="Open in Files" :href="path" @click.prevent="links.open(path)"><slot /></a>
</template>

<style scoped>
.media-ref {
  @apply font-mono typo-caption font-medium text-primary-deep underline decoration-primary/40 underline-offset-3;
}
</style>
