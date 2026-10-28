<script lang="ts" setup>
import { Pencil, Terminal, Trash2 } from "@lucide/vue";
import type { TaskMeta } from "~/utils/tasks";

interface Target {
  meta: TaskMeta;
  lead?: string;
}

const desk = $desk();
const terminal = $terminal();
const menu = useTemplateRef<{ openAt: (x: number, y: number) => void }>("menu");
const target = ref<Target>();

const openFor = (event: MouseEvent, meta: TaskMeta, lead?: string): void => {
  target.value = { meta, ...(lead ? { lead } : {}) };
  menu.value?.openAt(event.clientX, event.clientY);
};

const act = (close: () => void, run: (one: Target) => unknown): void => {
  const one = target.value;
  close();
  if (one) void run(one);
};

defineExpose({ openFor });
</script>

<template>
  <UiContextMenu ref="menu" data-region="org-task-menu" label="Task" width="w-48">
    <template #default="{ close }">
      <UiMenuItem
        :disabled="!target?.lead"
        :icon="Terminal"
        @click="act(close, (one) => one.lead && terminal.attach(one.lead))"
        >Attach</UiMenuItem
      >
      <UiMenuItem :icon="Pencil" @click="act(close, (one) => (desk.renaming = one.meta.slug))">Rename</UiMenuItem>
      <UiMenuItem :icon="Trash2" tone="destructive" @click="act(close, (one) => desk.remove(one.meta))"
        >Remove</UiMenuItem
      >
    </template>
  </UiContextMenu>
</template>
