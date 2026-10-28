<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { ArrowRight, ChevronDown, ChevronRight, Plus } from "@lucide/vue";
import type { Mark, OrgConversation, OrgProject, OrgTask } from "~/utils/org";
import type { TaskMeta } from "~/utils/tasks";

const sc = useSidecar();
const chrome = useChrome();
const task = $task();
const desk = $desk();
const artifact = $artifact();
const shown = useFaceShown();
const toggled = ref<Partial<Record<string, boolean>>>({});
const hot = ref<string>();
const hotTask = ref<string>();

const tree = computed(() =>
  Org.treeOf({
    sessions: sc.sessions.value,
    tasks: Tasks.of(sc.catalogue.value),
    projects: task.projects,
    asking: desk.asks.flatMap((ask) => (ask.kind === "escalation" && ask.from ? [ask.from] : [])),
  }),
);

const keys = computed(() => tree.value.projects.map((one) => one.project.key));
const tintOf = (key = ""): string => Tasks.tintOf(key, keys.value);
const routeOf = (meta: TaskMeta): OrgProject | undefined =>
  tree.value.projects.find((one) => one.project.key === desk.routes[meta.slug]);

const route = (meta: TaskMeta): void => {
  const to = routeOf(meta);
  if (to) void desk.place(meta, to.project);
};

const FOR_YOU: Mark[] = ["needs", "waits"];

const holdsInView = (group: OrgProject): boolean =>
  group.leads.some(front) ||
  [...group.tasks, ...group.done].some(
    (one) => one.meta.slug === task.slug || one.leads.some(front) || one.done.some(front),
  );

const isOpen = (group: OrgProject): boolean =>
  toggled.value[group.project.key] ?? ((!!group.mark && FOR_YOU.includes(group.mark)) || holdsInView(group));
const isUnfolded = (key: string): boolean => toggled.value[key] ?? false;
const toggle = (key: string, now: boolean): void => {
  toggled.value = { ...toggled.value, [key]: !now };
};

const front = (row: OrgConversation): boolean => row.key === sc.sessionKey.value;

const openConversation = (row: OrgConversation): void => {
  chrome.view.set("tasks");
  if (row.slug) void task.open(row.slug);
  if (row.key === sc.sessionKey.value) return;
  sc.sessionKey.value = row.key;
  void navigateTo(`/c/${row.key}`, { replace: true });
};

const leadTip = (one: OrgTask): string => {
  const lead = [...one.leads, ...one.done].find((row) => row.key === one.lead);
  return lead ? `Attach its lead, ${lead.title}, in your terminal` : "Attach in your terminal";
};

const start = (event: DragEvent, meta: TaskMeta): void => {
  event.dataTransfer?.setData("text/plain", meta.slug);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  requestAnimationFrame(() => (desk.dragging = meta.slug));
};

const dragged = computed(() => tree.value.inbox.find((one) => one.slug === desk.dragging));

const over = (event: DragEvent, group: OrgProject): void => {
  if (desk.carrying && !isOpen(group)) toggled.value = { ...toggled.value, [group.project.key]: true };
  if (!dragged.value || !group.project.folder) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  hot.value = group.project.key;
};

const drop = (event: DragEvent, group: OrgProject): void => {
  hot.value = undefined;
  const meta = dragged.value;
  if (!meta) return;
  event.preventDefault();
  desk.dragging = undefined;
  void desk.place(meta, group.project);
};

const carried = computed(() => tree.value.unplaced.find((one) => one.key === desk.carrying));

const carry = (event: DragEvent, row: OrgConversation): void => {
  event.dataTransfer?.setData("text/plain", row.title);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  requestAnimationFrame(() => (desk.carrying = row.key));
};

const letGo = (): void => {
  desk.carrying = undefined;
  hotTask.value = undefined;
};

const overTask = (event: DragEvent, one: OrgTask): void => {
  if (!carried.value || one.meta.task.state === "done") return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  hotTask.value = one.meta.slug;
};

const dropOnTask = (event: DragEvent, one: OrgTask, group: OrgProject): void => {
  const row = carried.value;
  letGo();
  if (!row || one.meta.task.state === "done") return;
  event.preventDefault();
  void desk.lead(row, one.meta, group.project);
};

useShortcuts(
  {
    N: () => {
      desk.isNaming = true;
    },
    "Mod+Z": () => desk.undoLast(),
  },
  { when: () => shown.value && !task.isEditing && !sc.failure.value },
);
</script>

<template>
  <UiSurface
    class="tree"
    data-region="org-tree"
    :data-listed="artifact.isFull && artifact.isListed"
    pad="none"
    variant="raised"
  >
    <header class="bar">
      <span class="title">Tasks</span>
      <span class="meta mono-meta">{{ tree.open }} open · {{ plural(tree.conversations, "conversation") }}</span>
      <span class="spacer" />
      <UiButton
        data-region="org-new-task"
        data-tip="New task · {N}"
        :icon="Plus"
        size="xs"
        variant="ghost"
        @click="desk.isNaming = true"
        >New task</UiButton
      >
    </header>

    <nav class="scroll" role="tree" aria-label="Who is where">
      <template v-if="tree.inbox.length || desk.isNaming">
        <span class="section mono-meta">Inbox</span>
        <OrgDraft v-if="desk.isNaming" />
        <div
          v-for="one in tree.inbox"
          :key="one.slug"
          class="inbox"
          draggable="true"
          role="treeitem"
          :aria-selected="one.slug === task.slug"
          :data-ghost="desk.dragging === one.slug"
          :data-selected="one.slug === task.slug"
          @dragend="desk.dragging = undefined"
          @dragstart="start($event, one)"
        >
          <button
            class="inbox-open plain-button focusable"
            type="button"
            :data-tip="one.title"
            @click="task.show({ slug: one.slug })"
          >
            <OrgMark mark="queued" />
            <span class="inbox-name">{{ one.title || deslug(one.slug) }}</span>
          </button>
          <UiButton
            v-if="routeOf(one)"
            class="route"
            :data-tip="`Route to ${routeOf(one)?.project.name}'s Project Lead`"
            :icon="ArrowRight"
            size="xs"
            variant="outline"
            @click="route(one)"
            ><span class="square" :data-tint="tintOf(routeOf(one)?.project.key)" />{{
              routeOf(one)?.project.name
            }}</UiButton
          >
        </div>
      </template>

      <span class="section mono-meta" data-gap="true">Assistant</span>
      <OrgRow
        v-for="row in tree.assistants"
        :key="row.key"
        :attach="row.key"
        :is-front="front(row)"
        :mark="row.mark"
        :name="row.name"
        role="EA"
        :tip="row.title"
        @open="openConversation(row)"
      />
      <p v-if="!tree.assistants.length" class="none">No assistant is running. Ask, bottom right, starts one.</p>

      <div
        v-for="group in tree.projects"
        :key="group.project.key"
        class="group"
        :data-hot="hot === group.project.key"
        @dragleave="hot = undefined"
        @dragover="over($event, group)"
        @drop="drop($event, group)"
      >
        <button
          class="project plain-button focusable"
          type="button"
          :aria-expanded="isOpen(group)"
          @click="toggle(group.project.key, isOpen(group))"
        >
          <UiIcon class="chevron" :icon="isOpen(group) ? ChevronDown : ChevronRight" size="xs" />
          <OrgMark v-if="group.mark" :mark="group.mark" />
          <span v-else class="mark-square"><span class="square" :data-tint="group.tint" /></span>
          <span class="project-name">{{ group.project.name }}</span>
          <span v-if="hot === group.project.key" class="drop mono-meta">to its Project Lead</span>
        </button>

        <template v-if="isOpen(group)">
          <OrgRow
            v-for="row in group.leads"
            :key="row.key"
            :attach="row.key"
            :depth="1"
            :is-front="front(row)"
            :mark="row.mark"
            :name="row.name"
            :role="row.role"
            :tip="row.title"
            @open="openConversation(row)"
          />

          <template
            v-for="one in [...group.tasks, ...(isUnfolded(`tasks:${group.project.key}`) ? group.done : [])]"
            :key="one.meta.slug"
          >
            <OrgRow
              class="landing"
              :attach="one.lead"
              :attach-tip="leadTip(one)"
              :data-hot="hotTask === one.meta.slug"
              :depth="1"
              is-task
              :is-selected="one.meta.slug === task.slug"
              :mark="one.mark"
              :name="one.meta.title || deslug(one.meta.slug)"
              @dragleave="hotTask = undefined"
              @dragover="overTask($event, one)"
              @drop="dropOnTask($event, one, group)"
              @open="task.show({ slug: one.meta.slug })"
            >
              <span v-if="hotTask === one.meta.slug" class="drop mono-meta">as its Task Lead</span>
            </OrgRow>
            <OrgRow
              v-for="row in [...one.leads, ...(isUnfolded(`done:${one.meta.slug}`) ? one.done : [])]"
              :key="row.key"
              :attach="row.key"
              :depth="2"
              :is-front="front(row)"
              :mark="row.mark"
              :name="row.name"
              :role="row.role"
              :tip="row.title"
              @open="openConversation(row)"
            />
            <button
              v-if="one.done.length"
              class="fold plain-button focusable"
              data-depth="2"
              type="button"
              :aria-expanded="isUnfolded(`done:${one.meta.slug}`)"
              @click="toggle(`done:${one.meta.slug}`, isUnfolded(`done:${one.meta.slug}`))"
            >
              <span class="guide" aria-hidden="true" />
              <span class="guide deep" aria-hidden="true" />
              <UiIcon :icon="isUnfolded(`done:${one.meta.slug}`) ? ChevronDown : ChevronRight" size="xs" />
              <span class="mono-meta">{{ one.done.length }} done</span>
            </button>
          </template>

          <button
            v-if="group.done.length"
            class="fold plain-button focusable"
            data-depth="1"
            type="button"
            :aria-expanded="isUnfolded(`tasks:${group.project.key}`)"
            @click="toggle(`tasks:${group.project.key}`, isUnfolded(`tasks:${group.project.key}`))"
          >
            <span class="guide" aria-hidden="true" />
            <UiIcon :icon="isUnfolded(`tasks:${group.project.key}`) ? ChevronDown : ChevronRight" size="xs" />
            <span class="mono-meta">{{ plural(group.done.length, "done task") }}</span>
          </button>
        </template>
      </div>

      <template v-if="tree.unplaced.length">
        <span class="section mono-meta" data-gap="true">No project</span>
        <OrgRow
          v-for="row in tree.unplaced"
          :key="row.key"
          class="carry"
          :attach="row.key"
          :data-ghost="desk.carrying === row.key"
          draggable="true"
          :is-front="front(row)"
          :mark="row.mark"
          :name="row.name"
          :role="row.role"
          :tip="row.title"
          @dragend="letGo"
          @dragstart="carry($event, row)"
          @open="openConversation(row)"
        />
      </template>
    </nav>
  </UiSurface>
</template>

<style scoped>
.tree {
  @apply flex min-h-0 flex-col overflow-hidden;
}

/* The Artifacts list's place over a grown sheet, so another task opens without leaving fullscreen. */
.tree[data-listed="true"] {
  @apply fixed top-14 bottom-2 left-2 z-28 w-85;
}

.bar {
  @apply flex flex-none items-center gap-2 border-b border-b-border py-1.75 pr-2 pl-3.5;
}

.title {
  @apply typo-body-strong font-bold;
}

.meta {
  @apply min-w-0 truncate text-muted normal-case;
}

.spacer {
  @apply flex-1;
}

.scroll {
  @apply flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2 pt-1.5 pb-(--float-clear);
}

.scroll > * {
  @apply flex-none;
}

.section {
  @apply flex h-6 items-center px-1.5 text-subtle;
}

.section[data-gap="true"] {
  @apply mt-2;
}

.none {
  @apply m-0 px-1.5 py-1 typo-caption text-pretty text-muted;
}

.inbox {
  @apply box-border flex h-7 cursor-grab items-center gap-1.75 rounded-lg border border-transparent pr-0.5 pl-1;
}

.inbox[data-selected="true"] {
  @apply border-border-strong bg-sunken;
}

.inbox[data-ghost="true"],
.carry[data-ghost="true"] {
  @apply border-dashed border-border-strong opacity-50;
}

.carry {
  @apply cursor-grab;
}

.landing[data-hot="true"] {
  @apply bg-primary-soft outline-2 outline-offset-1 outline-primary outline-dashed;
}

@media (hover: hover) and (pointer: fine) {
  .inbox:not([data-selected="true"]):hover,
  .project:hover,
  .fold:hover {
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

.square {
  @apply size-1.75 flex-none rounded-xs bg-tint;
}

.group {
  @apply mt-1.5 flex flex-col gap-px rounded-lg outline-2 outline-offset-1 outline-transparent transition-colors duration-(--duration-fast) ease-out;
}

.group[data-hot="true"] {
  @apply bg-primary-soft outline-primary outline-dashed;
}

.project {
  @apply flex h-7.5 w-full items-center gap-2 rounded-lg border-0 bg-transparent pr-2 pl-1 text-left text-fg;
}

.chevron {
  @apply flex-none text-muted;
}

.mark-square {
  @apply inline-flex size-3 flex-none items-center justify-center;
}

.mark-square .square {
  @apply size-2.25 rounded-sm;
}

.project-name {
  @apply min-w-0 flex-1 typo-body font-bold;
}

.drop {
  @apply flex-none text-primary-deep normal-case;
}

.fold {
  @apply relative box-border flex h-6 items-center gap-1.5 self-start rounded-lg border-0 bg-transparent pr-2 pl-7 text-muted;
}

.fold[data-depth="2"] {
  @apply pl-14;
}

.fold .guide {
  @apply absolute -top-px -bottom-px left-2.25 w-px origin-left scale-x-50 bg-border;
}

.fold .guide.deep {
  @apply left-10;
}
</style>
