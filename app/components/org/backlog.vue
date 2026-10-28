<script lang="ts" setup>
import { ArrowRight, Trash2 } from "@lucide/vue";
import type { OrgProject } from "~/utils/org";
import type { TaskMeta } from "~/utils/tasks";

const { inbox, projects } = defineProps<{ inbox: TaskMeta[]; projects: OrgProject[] }>();

const task = $task();
const desk = $desk();

const rows = computed(() =>
  inbox.map((meta) => ({ meta, to: projects.find((one) => one.project.key === desk.routes[meta.slug]) })),
);

const start = (event: DragEvent, meta: TaskMeta): void => {
  event.dataTransfer?.setData("text/plain", meta.slug);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  requestAnimationFrame(() => (desk.dragging = meta.slug));
};
</script>

<template>
  <template v-if="inbox.length || desk.isNaming">
    <span class="section mono-meta">Backlog</span>
    <OrgDraft v-if="desk.isNaming" />
    <div
      v-for="{ meta, to } in rows"
      :key="meta.slug"
      class="inbox"
      draggable="true"
      role="treeitem"
      :aria-selected="meta.slug === task.slug"
      :data-ghost="desk.dragging === meta.slug"
      :data-selected="meta.slug === task.slug"
      @dragend="desk.dragging = undefined"
      @dragstart="start($event, meta)"
    >
      <button
        class="inbox-open plain-button focusable"
        type="button"
        :data-tip="meta.title"
        @click="task.show({ slug: meta.slug })"
      >
        <OrgMark mark="queued" />
        <span class="inbox-name">{{ meta.title || deslug(meta.slug) }}</span>
      </button>
      <UiButton
        v-if="to"
        class="route"
        :data-tip="`Route to ${to.project.name}'s Project Lead`"
        :icon="ArrowRight"
        size="xs"
        variant="outline"
        @click="desk.place(meta, to.project)"
        ><OrgAvatar :project="to.project" :tint="to.tint" />{{ to.project.name }}</UiButton
      >
      <UiIconButton
        class="delete"
        :icon="Trash2"
        aria-label="Delete"
        data-tip="Delete it. Undo, or ⌘Z, brings it back"
        size="xs"
        @click="desk.remove(meta)"
      />
    </div>
  </template>
</template>

<style scoped>
.section {
  @apply flex h-6 flex-none items-center px-1.5 text-subtle;
}

.inbox {
  @apply box-border flex h-7 flex-none cursor-grab items-center gap-1.75 rounded-lg border border-transparent pr-0.5 pl-1;
}

.inbox[data-selected="true"] {
  @apply border-border-strong bg-sunken;
}

.inbox[data-ghost="true"] {
  @apply border-dashed border-border-strong opacity-50;
}

@media (hover: hover) and (pointer: fine) {
  .inbox:not([data-selected="true"]):hover {
    @apply bg-sunken;
  }
}

.inbox-open {
  @apply flex h-6.5 min-w-0 flex-1 items-center gap-1.75 border-0 bg-transparent px-1 text-left text-fg;
}

.inbox-name {
  @apply min-w-0 flex-1 truncate typo-caption font-medium;
}

.route {
  @apply flex-none text-muted;
}

.delete {
  @apply flex-none opacity-0 transition-opacity duration-(--duration-fast) ease-out focus-visible:opacity-100;
}

.inbox:hover .delete,
.inbox[data-selected="true"] .delete {
  @apply opacity-100;
}
</style>
