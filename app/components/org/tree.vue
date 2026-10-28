<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { ChevronDown, ChevronRight, Plus } from "@lucide/vue";
import type { Mark, OrgConversation, OrgProject, OrgTask } from "~/utils/org";
import type { TaskMeta } from "~/utils/tasks";

const sc = useSidecar();
const chrome = useChrome();
const task = $task();
const desk = $desk();
const artifact = $artifact();
const conversationMenu = $conversationMenu();
const shown = useFaceShown();
const folds = useOrgFolds();
const hot = ref<string>();
const hotTask = ref<string>();
const menu = useTemplateRef<{ openFor: (event: MouseEvent, meta: TaskMeta, lead?: string) => void }>("menu");

const tree = useOrgTree();

const FOR_YOU: Mark[] = ["needs", "waits"];

const holdsInView = (group: OrgProject): boolean =>
  group.leads.some(front) ||
  group.conversations.some(front) ||
  [...group.tasks, ...group.done].some(
    (one) => one.meta.slug === task.slug || one.leads.some(front) || one.done.some(front),
  );

const isOpen = (group: OrgProject): boolean =>
  folds.isOpen(group.project.key, (!!group.mark && FOR_YOU.includes(group.mark)) || holdsInView(group));

const slugOf = (one: OrgTask): string => one.meta.slug;

const front = (row: OrgConversation): boolean => row.key === sc.sessionKey.value;

const openConversation = (row: OrgConversation): void => {
  chrome.view.set("tasks");
  if (row.slug) void task.open(row.slug);
  if (row.key === sc.sessionKey.value) return;
  sc.sessionKey.value = row.key;
  void navigateTo(`/c/${row.key}`, { replace: true });
};

const menuFor = (event: MouseEvent, row: OrgConversation): void =>
  conversationMenu.openFor(event, { key: row.key, title: row.title, open: () => openConversation(row) });

const dragged = computed(() => tree.value.inbox.find((one) => one.slug === desk.dragging));

const isHome = (group: OrgProject, row: OrgConversation): boolean =>
  group.conversations.some((one) => one.key === row.key);

const over = (event: DragEvent, group: OrgProject): void => {
  const row = carried.value;
  if (row && !isOpen(group)) folds.toggle(group.project.key, false);
  if (row ? isHome(group, row) : !dragged.value || !group.project.folder) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  hot.value = group.project.key;
};

const drop = (event: DragEvent, group: OrgProject): void => {
  hot.value = undefined;
  const row = carried.value;
  if (row) {
    letGo();
    if (isHome(group, row)) return;
    event.preventDefault();
    return void desk.bring(row, group.project);
  }
  const meta = dragged.value;
  if (!meta) return;
  event.preventDefault();
  desk.dragging = undefined;
  void desk.place(meta, group.project);
};

const carried = computed(() =>
  [...tree.value.unplaced, ...tree.value.projects.flatMap((one) => one.conversations)].find(
    (one) => one.key === desk.carrying,
  ),
);

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
  event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  hot.value = undefined;
  hotTask.value = one.meta.slug;
};

const dropOnTask = (event: DragEvent, one: OrgTask): void => {
  const row = carried.value;
  if (!row || one.meta.task.state === "done") return;
  event.preventDefault();
  event.stopPropagation();
  letGo();
  void desk.lead(row, one.meta);
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
      <OrgBacklog :inbox="tree.inbox" :projects="tree.projects" @menu="(event, meta) => menu?.openFor(event, meta)" />

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
        @contextmenu.prevent="menuFor($event, row)"
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
          @click="folds.toggle(group.project.key, isOpen(group))"
        >
          <UiIcon class="chevron" :icon="isOpen(group) ? ChevronDown : ChevronRight" size="xs" />
          <OrgAvatar :project="group.project" :tint="group.tint" />
          <span class="project-name">{{ group.project.name }}</span>
          <span v-if="hot === group.project.key" class="drop mono-meta">{{
            carried ? `as [${group.project.token}]` : "to its Project Lead"
          }}</span>
          <OrgMark v-if="group.mark" :mark="group.mark" />
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
            @contextmenu.prevent="menuFor($event, row)"
            @open="openConversation(row)"
          />

          <template
            v-for="line in folds.linesOf({
              open: group.tasks,
              done: group.done,
              fold: `tasks:${group.project.key}`,
              depth: 1,
              keyOf: slugOf,
            })"
            :key="line.key"
          >
            <OrgFold
              v-if="'fold' in line"
              :depth="line.depth"
              :fold="line.key"
              :label="plural(line.fold, 'done task')"
            />
            <OrgTaskRow
              v-else
              :depth="line.depth"
              :is-hot="hotTask === line.item.meta.slug"
              :one="line.item"
              @drop="dropOnTask($event, line.item)"
              @leave="hotTask = undefined"
              @menu="(event, lead) => menu?.openFor(event, line.item.meta, lead)"
              @open="openConversation"
              @over="overTask($event, line.item)"
            />
          </template>

          <OrgRow
            v-for="row in group.conversations"
            :key="row.key"
            class="carry"
            :attach="row.key"
            :data-ghost="desk.carrying === row.key"
            :depth="1"
            draggable="true"
            :is-front="front(row)"
            :mark="row.mark"
            :name="row.name"
            :tip="row.title"
            @contextmenu.prevent="menuFor($event, row)"
            @dragend="letGo"
            @dragstart="carry($event, row)"
            @open="openConversation(row)"
          />
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
          @contextmenu.prevent="menuFor($event, row)"
          @dragend="letGo"
          @dragstart="carry($event, row)"
          @open="openConversation(row)"
        />
      </template>
    </nav>
    <OrgTaskMenu ref="menu" />
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

.carry[data-ghost="true"] {
  @apply border-dashed border-border-strong opacity-50;
}

.carry {
  @apply cursor-grab;
}

@media (hover: hover) and (pointer: fine) {
  .project:hover {
    @apply bg-sunken;
  }
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

.project-name {
  @apply min-w-0 flex-1 typo-body font-bold;
}

.drop {
  @apply flex-none text-primary-deep normal-case;
}
</style>
