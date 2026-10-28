<script lang="ts" setup>
const {
  action = "Add",
  depth = 0,
  initial = "",
  label,
  placeholder,
  tip,
} = defineProps<{
  action?: string;
  depth?: number;
  initial?: string;
  label: string;
  placeholder: string;
  tip: string;
}>();
const emit = defineEmits<{ name: [title: string]; cancel: [] }>();

const field = useTemplateRef<HTMLInputElement>("field");
const title = ref(initial);

const submit = (): void => {
  const named = title.value.trim();
  if (named) emit("name", named);
};

const leave = (): void => {
  const named = title.value.trim();
  if (!named || named === initial) emit("cancel");
};

onMounted(() => {
  field.value?.focus();
  field.value?.select();
});
</script>

<template>
  <form class="draft" :aria-label="label" data-region="org-draft" :data-depth="depth" @submit.prevent="submit">
    <OrgMark mark="queued" />
    <input
      ref="field"
      v-model="title"
      class="field"
      type="text"
      :aria-label="label"
      :placeholder="placeholder"
      @blur="leave"
      @keydown.esc.stop.prevent="emit('cancel')"
    />
    <UiButton :data-tip="tip" :disabled="!title.trim()" size="xs" type="submit" variant="primary">{{
      action
    }}</UiButton>
  </form>
</template>

<style scoped>
.draft {
  @apply box-border flex h-8 flex-none items-center gap-1.75 rounded-lg border border-primary bg-raised pr-0.75 pl-2.25 ring-3 ring-primary-soft;
}

.draft[data-depth="1"] {
  @apply ml-5.5;
}

.draft[data-depth="2"] {
  @apply ml-12.5;
}

.field {
  @apply min-w-0 flex-1 border-0 bg-transparent p-0 font-sans typo-caption font-medium text-fg outline-none placeholder:text-subtle;
}
</style>
