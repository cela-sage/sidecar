<script lang="ts" setup>
import { Check, Pencil, Trash2 } from "@lucide/vue";
import type { TaskMeta } from "~/utils/tasks";

const desk = $desk();
const menu = useTemplateRef<{ openAt: (x: number, y: number) => void }>("menu");
const target = ref<TaskMeta>();

const openFor = (event: MouseEvent, meta: TaskMeta): void => {
  target.value = meta;
  menu.value?.openAt(event.clientX, event.clientY);
};

const act = (close: () => void, run: (meta: TaskMeta) => unknown): void => {
  const meta = target.value;
  close();
  if (meta) void run(meta);
};

defineExpose({ openFor });
</script>

<template>
  <UiContextMenu ref="menu" data-region="org-task-menu" label="Task" width="w-48">
    <template #default="{ close }">
      <UiMenuItem
        :disabled="!target?.task.project || target.task.state === 'done'"
        :icon="Check"
        @click="act(close, (meta) => desk.markDone(meta))"
        >Mark done</UiMenuItem
      >
      <UiMenuItem :icon="Pencil" @click="act(close, (meta) => (desk.renaming = meta.slug))">Rename</UiMenuItem>
      <UiMenuItem :icon="Trash2" tone="destructive" @click="act(close, (meta) => desk.remove(meta))"
        >Remove</UiMenuItem
      >
    </template>
  </UiContextMenu>
</template>
