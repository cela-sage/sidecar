<script lang="ts" setup>
import type { DoorReceipt } from "~/stores/door";

const { receipt } = defineProps<{ receipt: DoorReceipt }>();
const door = $door();
const task = $task();
const sc = useSidecar();

const line = computed(() => Receipts.lineOf(receipt, { tasks: Tasks.of(sc.catalogue.value), projects: task.projects }));
const canUndo = computed(() => !receipt.isUndone && receipt.was === "unassigned" && receipt.now !== "unassigned");
</script>

<template>
  <div class="receipt">
    <OrgMark :mark="receipt.isUndone ? 'queued' : 'idle'" />
    <span class="what">
      <span class="line">
        <span v-if="line.where" class="project">
          <OrgAvatar :project="line.where.project" :tint="line.where.tint" />{{ line.where.project.name }}
        </span>
        <span class="title">{{ line.title }}</span>
      </span>
      <span class="note mono-meta">{{
        receipt.isUndone ? "back in the backlog" : `${receipt.was} to ${receipt.now}`
      }}</span>
    </span>
    <button
      v-if="canUndo"
      class="link plain-button focusable"
      data-tip="Put it back in the backlog"
      type="button"
      @click="door.undo(receipt)"
    >
      Undo
    </button>
  </div>
</template>

<style scoped>
.receipt {
  @apply box-border flex min-h-9.5 items-center gap-2 border-t border-t-border py-1.5 pr-2 pl-2.5 first:border-t-0;
}

.what {
  @apply flex min-w-0 flex-1 flex-col gap-px;
}

.line {
  @apply flex min-w-0 items-center gap-1.5;
}

.project {
  @apply flex flex-none items-center gap-1 typo-caption-strong text-muted;
}

.title {
  @apply truncate typo-caption;
}

.note {
  @apply truncate text-muted normal-case;
}

.link {
  @apply flex-none border-0 bg-transparent px-1 typo-caption font-semibold text-muted underline underline-offset-3;
}
</style>
