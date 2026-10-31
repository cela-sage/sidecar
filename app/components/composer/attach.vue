<script lang="ts" setup>
import { Paperclip } from "@lucide/vue";

const emit = defineEmits<{ files: [files: File[]] }>();

const picker = useTemplateRef<HTMLInputElement>("picker");

const onPicked = (): void => {
  emit("files", [...(picker.value?.files ?? [])]);
  if (picker.value) picker.value.value = "";
};
</script>

<template>
  <span class="attach">
    <UiIconButton
      :icon="Paperclip"
      aria-label="Attach a file"
      data-tip="Attach a file"
      size="xs"
      @click="picker?.click()"
    />
    <input ref="picker" class="picker" multiple type="file" @change="onPicked" />
  </span>
</template>

<style scoped>
.attach {
  @apply inline-flex;
}

.picker {
  @apply hidden;
}
</style>
