<script lang="ts" setup>
import type { Project } from "~~/shared/types/task";

const { project, tint } = defineProps<{ project: Project; tint: string }>();

const isBroken = ref(false);
const source = computed(() => `/api/projects/${encodeURIComponent(project.key)}/image`);

watch(source, () => (isBroken.value = false));
</script>

<template>
  <span class="avatar" aria-hidden="true" :data-tint="tint">
    <img v-if="project.image && !isBroken" alt="" class="image" :src="source" @error="isBroken = true" />
    <span v-else-if="project.icon" class="icon">{{ project.icon }}</span>
    <span v-else class="square" />
  </span>
</template>

<style scoped>
.avatar {
  @apply inline-flex size-4 flex-none items-center justify-center overflow-hidden rounded-sm;
}

.image {
  @apply size-full object-cover;
}

.icon {
  @apply typo-caption leading-none;
}

.square {
  @apply size-2.25 rounded-sm bg-tint;
}
</style>
