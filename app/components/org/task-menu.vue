<script lang="ts" setup>
import { Archive, ArchiveRestore, Pencil, Square } from "@lucide/vue";
import type { TaskMeta } from "~/utils/tasks";

const desk = $desk();
const tree = useOrgTree();
const menu = useTemplateRef<{ openAt: (x: number, y: number) => void }>("menu");
const target = ref<TaskMeta>();

const one = computed(() => (target.value ? Org.taskIn(tree.value, target.value.slug) : undefined));
const alive = computed(() => (one.value ? Org.aliveOf(one.value.leads) : []));
const isArchived = computed(() => !!one.value && Workstreams.isArchived(one.value.status));
const killTip = computed(() => {
  const names = new Intl.ListFormat("en").format(alive.value.map((row) => row.agent?.name ?? row.name));
  return `Kills ${names}. The Domain Lead, the Solution Lead and your Assistant stay. Undo · ⌘Z`;
});

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
  <UiContextMenu ref="menu" data-region="org-task-menu" label="Workstream" width="w-48">
    <template #default="{ close }">
      <UiMenuItem :icon="Pencil" @click="act(close, (meta) => (desk.renaming = meta.slug))">Rename</UiMenuItem>
      <template v-if="one">
        <span class="rule" aria-hidden="true" />
        <UiMenuItem
          v-if="isArchived"
          data-tip="Brings it back with its channel. Its agents stay killed · Undo ⌘Z"
          :icon="ArchiveRestore"
          @click="act(close, (meta) => desk.restore(meta))"
          >Restore</UiMenuItem
        >
        <template v-else>
          <UiMenuItem
            v-if="alive.length"
            :data-tip="killTip"
            :icon="Square"
            tone="destructive"
            @click="act(close, (meta) => desk.kill(meta))"
            >Kill its {{ plural(alive.length, "agent") }}</UiMenuItem
          >
          <span
            class="archive"
            :data-off="!!alive.length"
            :data-tip="
              alive.length ? 'Kill its agents first' : 'Closes it and its channel. Restore it from Archived · Undo ⌘Z'
            "
          >
            <UiMenuItem :disabled="!!alive.length" :icon="Archive" @click="act(close, (meta) => desk.archive(meta))"
              >Archive</UiMenuItem
            >
          </span>
        </template>
      </template>
    </template>
  </UiContextMenu>
</template>

<style scoped>
.rule {
  @apply mx-1.5 my-1 block h-px bg-border;
}

.archive {
  @apply block;
}

.archive[data-off="true"] {
  @apply cursor-not-allowed;
}

.archive[data-off="true"] :deep(.menu-item) {
  @apply pointer-events-none;
}
</style>
