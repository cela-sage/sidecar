<script lang="ts" setup>
import { Plus } from "@lucide/vue";

const desk = $desk();
const field = useTemplateRef<HTMLInputElement>("field");
const title = ref("");

const create = async (): Promise<void> => {
  const named = title.value.trim();
  if (!named) return;
  const slug = await desk.create(named);
  if (!slug) return;
  title.value = "";
  desk.isNaming = false;
  await navigateTo(`/tasks/${slug}?edit=1`);
};

const cancel = (): void => {
  title.value = "";
  desk.isNaming = false;
};

watch(
  () => desk.isNaming,
  (naming) => naming && void nextTick(() => field.value?.focus()),
  { immediate: true },
);

onBeforeUnmount(() => (desk.isNaming = false));
</script>

<template>
  <form v-if="desk.isNaming" class="naming" @submit.prevent="create">
    <input
      ref="field"
      v-model="title"
      class="field"
      type="text"
      aria-label="Name the new task"
      placeholder="Name the task, then write it in Edit"
      @blur="!title.trim() && cancel()"
      @keydown.esc.stop.prevent="cancel"
    />
    <UiButton :disabled="!title.trim()" size="xs" type="submit" variant="secondary">Create</UiButton>
  </form>
  <button
    v-else
    class="new plain-button focusable"
    data-tip="New task · {N}"
    type="button"
    @click="desk.isNaming = true"
  >
    <UiIcon :icon="Plus" size="xs" />
    New task
    <span class="spacer" />
    <span class="hint">type, paste an image, or ask for a draft</span>
  </button>
</template>

<style scoped>
.naming {
  @apply flex h-10 flex-none items-center gap-2 rounded-field border border-border-strong bg-raised pr-1.5 pl-3.5;
}

.field {
  @apply min-w-0 flex-1 border-0 bg-transparent p-0 font-sans typo-body text-fg outline-none placeholder:text-subtle;
}

.new {
  @apply box-border flex h-10 flex-none items-center gap-2 rounded-field border border-dashed border-border-strong bg-transparent px-3.5 typo-caption font-semibold whitespace-nowrap text-muted;
}

.spacer {
  @apply flex-1;
}

.hint {
  @apply min-w-0 truncate font-normal;
}
</style>
