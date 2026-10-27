<script lang="ts" setup>
const desk = $desk();
const task = $task();
const field = useTemplateRef<HTMLInputElement>("field");
const title = ref("");

const create = async (): Promise<void> => {
  const named = title.value.trim();
  if (!named) return;
  const slug = await desk.create(named);
  if (!slug) return;
  title.value = "";
  desk.isNaming = false;
  task.show({ slug, edit: true });
};

const cancel = (): void => {
  title.value = "";
  desk.isNaming = false;
};

onMounted(() => field.value?.focus());
</script>

<template>
  <form class="draft" aria-label="New task" data-region="org-draft" @submit.prevent="create">
    <OrgMark mark="queued" />
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
    <UiButton data-tip="Add to inbox · {enter}" :disabled="!title.trim()" size="xs" type="submit" variant="primary"
      >Add</UiButton
    >
  </form>
</template>

<style scoped>
.draft {
  @apply box-border flex h-8 items-center gap-1.75 rounded-lg border border-primary bg-raised pr-0.75 pl-2.25 ring-3 ring-primary-soft;
}

.field {
  @apply min-w-0 flex-1 border-0 bg-transparent p-0 font-sans typo-caption font-medium text-fg outline-none placeholder:text-subtle;
}
</style>
