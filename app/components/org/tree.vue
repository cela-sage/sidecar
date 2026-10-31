<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { ChevronDown, ChevronRight } from "@lucide/vue";
import { useIntervalFn } from "@vueuse/core";
import type { Mark, OrgConversation, OrgProject, OrgTask } from "~/utils/org";
import type { TaskMeta } from "~/utils/tasks";

const READ_MS = 5000;

const sc = useSidecar();
const task = $task();
const desk = $desk();
const events = useEvents();
const conversationMenu = $conversationMenu();
const folds = useOrgFolds();
const hot = ref<string>();
const hotTask = ref<string>();
const menu = useTemplateRef<{ openFor: (event: MouseEvent, meta: TaskMeta) => void }>("menu");

const tree = useOrgTree();

const FOR_YOU: Mark[] = ["needs", "waits"];

const holdsInView = (group: OrgProject): boolean =>
  group.leads.some(front) ||
  group.conversations.some(front) ||
  [...group.tasks, ...group.archived].some((one) => one.meta.slug === task.slug || one.leads.some(front));

const isOpen = (group: OrgProject): boolean =>
  folds.isOpen(group.project.key, (!!group.mark && FOR_YOU.includes(group.mark)) || holdsInView(group));

const front = (row: OrgConversation): boolean => !task.slug && row.key === sc.sessionKey.value;

const openConversation = (row: OrgConversation): void => {
  task.close();
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
  if (!carried.value || Tasks.isArchived(one.meta.task.state)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  hot.value = undefined;
  hotTask.value = one.meta.slug;
};

const dropOnTask = (event: DragEvent, one: OrgTask): void => {
  const row = carried.value;
  if (!row || Tasks.isArchived(one.meta.task.state)) return;
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
  { when: () => !task.isEditing && !sc.failure.value },
);

const heard = ({ data }: { data: { slug: string } }): void => {
  void desk.load();
  void task.readTasks();
  if (data.slug === task.slug) void task.refresh();
};

void task.loadProjects();
void task.readTasks();
events.on("task.changed", heard);
events.on("task.escalated", heard);
events.on("task.decided", heard);

// A stamp changes with no event when Mode's own CLI writes it, so the tree reads the catalogue again.
useIntervalFn(() => void task.readTasks(), READ_MS);
// Routing a backlog task asks a model, so the desk is read when the backlog changes rather than on the poll.
watch(
  () => tree.value.inbox.map((one) => one.slug).join(" "),
  () => void desk.load(),
  { immediate: true },
);
</script>

<template>
  <nav class="tree" data-region="org-tree" role="tree" aria-label="Who is where">
    <OrgBacklog :inbox="tree.inbox" :projects="tree.projects" @menu="(event, meta) => menu?.openFor(event, meta)" />

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
          carried ? `as [${group.project.token}]` : "to its Domain Lead"
        }}</span>
        <OrgMark v-if="group.mark" :mark="group.mark" />
      </button>

      <template v-if="isOpen(group)">
        <OrgRow
          v-for="row in group.leads"
          :key="row.key"
          :conversation="row.key"
          :depth="1"
          :is-front="front(row)"
          :mark="row.mark"
          :name="row.name"
          :role="row.role"
          :tip="row.title"
          @contextmenu.prevent="menuFor($event, row)"
          @open="openConversation(row)"
        />

        <OrgTaskRow
          v-for="one in group.tasks"
          :key="one.meta.slug"
          :depth="1"
          :is-hot="hotTask === one.meta.slug"
          :one="one"
          @drop="dropOnTask($event, one)"
          @leave="hotTask = undefined"
          @menu="(event) => menu?.openFor(event, one.meta)"
          @open="openConversation"
          @over="overTask($event, one)"
        />

        <OrgRow
          v-for="row in group.conversations"
          :key="row.key"
          class="carry"
          :conversation="row.key"
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

        <template v-if="group.archived.length">
          <OrgFold :depth="1" :fold="`archived:${group.project.key}`" :label="`${group.archived.length} archived`" />
          <template v-if="folds.isOpen(`archived:${group.project.key}`)">
            <OrgTaskRow
              v-for="one in group.archived"
              :key="one.meta.slug"
              :depth="2"
              :one="one"
              @menu="(event) => menu?.openFor(event, one.meta)"
              @open="openConversation"
            />
          </template>
        </template>
      </template>
    </div>

    <template v-if="tree.unplaced.length">
      <span class="section mono-meta" data-gap="true">No project</span>
      <OrgRow
        v-for="row in tree.unplaced"
        :key="row.key"
        class="carry"
        :conversation="row.key"
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
</template>

<style scoped>
.tree {
  @apply flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2 pt-1.5 pb-2;
}

.tree > * {
  @apply flex-none;
}

.section {
  @apply flex h-6 items-center px-1.5 text-subtle;
}

.section[data-gap="true"] {
  @apply mt-2;
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
