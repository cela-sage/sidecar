<script lang="ts" setup>
import { GripVertical, Plus } from "@lucide/vue";
import type { Project } from "~~/shared/types/task";
import type { TaskMeta } from "~/utils/tasks";

const { active, tasks } = defineProps<{ active?: string; tasks: TaskMeta[] }>();

const task = $task();
const desk = $desk();
const field = useTemplateRef<HTMLInputElement>("field");
const title = ref("");

const routeOf = (meta: TaskMeta): Project | undefined =>
  task.projects.find((one) => one.key === desk.routes[meta.slug]);
const tintOf = (key: string): string =>
  Tasks.tintOf(
    key,
    task.projects.map((one) => one.key),
  );
const dayOf = (meta: TaskMeta): string =>
  meta.updated ? `updated ${new Date(meta.updated).toLocaleDateString([], { day: "numeric", month: "short" })}` : "";

const start = (event: DragEvent, meta: TaskMeta): void => {
  event.dataTransfer?.setData("text/plain", meta.slug);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  requestAnimationFrame(() => (desk.dragging = meta.slug));
};

const route = (meta: TaskMeta): void => {
  const project = routeOf(meta);
  if (project) void desk.place(meta, project);
};

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
);
</script>

<template>
  <section class="inbox" aria-label="Inbox" data-region="desk-inbox">
    <div class="head">
      <span class="title">Inbox</span>
      <span class="meta mono-meta">{{ tasks.length }} unassigned</span>
    </div>
    <p class="hint">Drag a task onto a project, or let the assistant route it to that project's lead.</p>

    <article
      v-for="one in tasks"
      :id="`desk-task-${one.slug}`"
      :key="one.slug"
      class="card"
      data-region="desk-card"
      data-cmt="task"
      draggable="true"
      :data-active="one.slug === active"
      :data-cmt-label="one.title"
      :data-cmt-tell="`the ${one.title} task in the inbox`"
      :data-ghost="desk.dragging === one.slug"
      @click="navigateTo(`/tasks/${one.slug}`)"
      @dragend="desk.dragging = undefined"
      @dragstart="start($event, one)"
    >
      <div class="line">
        <TaskDot class="card-dot" look="waiting" />
        <span class="name">{{ one.title || deslug(one.slug) }}</span>
        <UiIcon class="grip" :icon="GripVertical" size="xs" />
      </div>
      <div class="foot">
        <span class="from mono-meta">{{ dayOf(one) }}</span>
        <span class="spacer" />
        <UiButton
          v-if="routeOf(one)"
          class="route"
          :data-tip="`The assistant suggests ${routeOf(one)?.name}. Hands it to its Project Lead`"
          size="xs"
          variant="outline"
          @click.stop="route(one)"
          ><span class="square" :data-tint="tintOf(routeOf(one)?.key ?? '')" />Route to
          {{ routeOf(one)?.name }}</UiButton
        >
      </div>
    </article>

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
      data-region="desk-new-task"
      data-tip="New task · {N}"
      type="button"
      @click="desk.isNaming = true"
    >
      <UiIcon :icon="Plus" size="xs" />
      New task
      <span class="spacer" />
      <span class="new-hint">type, paste an image, or ask for a draft</span>
    </button>
  </section>
</template>

<style scoped>
.inbox {
  @apply flex flex-col gap-2.5 pt-0.5;
}

.head {
  @apply flex items-center gap-2;
}

.title {
  @apply typo-body font-bold;
}

.meta {
  @apply text-muted normal-case;
}

.hint {
  @apply m-0 -mt-1 typo-caption leading-normal text-pretty text-muted;
}

.card {
  @apply box-border flex cursor-grab flex-col gap-2 rounded-xl border border-border bg-raised px-3.5 py-3 shadow-sm;
}

.card[data-active="true"] {
  @apply border-border-strong;
}

.card[data-ghost="true"] {
  @apply border-dashed border-border-strong bg-sunken shadow-none;
}

.card[data-ghost="true"] > * {
  @apply invisible;
}

.line {
  @apply flex items-start gap-2.25;
}

.card-dot {
  @apply mt-1.25 flex-none;
}

.name {
  @apply flex-1 typo-body leading-snug font-semibold text-pretty;
}

.grip {
  @apply mt-0.5 flex-none text-muted;
}

.foot {
  @apply flex items-center gap-2 pl-4;
}

.from {
  @apply min-w-0 truncate text-muted;
}

.spacer {
  @apply flex-1;
}

.route {
  @apply text-muted;
}

.square {
  @apply size-1.75 rounded-xs bg-tint;
}

.naming {
  @apply flex h-10 items-center gap-2 rounded-field border border-border-strong bg-raised pr-1.5 pl-3.5;
}

.field {
  @apply min-w-0 flex-1 border-0 bg-transparent p-0 font-sans typo-body text-fg outline-none placeholder:text-subtle;
}

.new {
  @apply box-border flex h-10 items-center gap-2 rounded-field border border-dashed border-border-strong bg-transparent px-3.5 typo-caption font-semibold text-muted;
}

.new-hint {
  @apply font-normal;
}
</style>
