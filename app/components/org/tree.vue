<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { ArrowRight, ChevronDown, ChevronRight, Plus, Trash2, X } from "@lucide/vue";
import { useLocalStorage } from "@vueuse/core";
import type { Mark, OrgConversation, OrgProject, OrgTask } from "~/utils/org";
import type { TaskMeta } from "~/utils/tasks";
import { tintOf as agentTint } from "~/utils/tint";

const sc = useSidecar();
const chrome = useChrome();
const task = $task();
const desk = $desk();
const artifact = $artifact();
const shown = useFaceShown();
const toggled = useLocalStorage<Partial<Record<string, boolean>>>("sc:org-folds", {});
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
  group.conversations.some(front) ||
  [...group.tasks, ...group.done].some(
    (one) => one.meta.slug === task.slug || one.leads.some(front) || one.done.some(front),
  );

const isOpen = (group: OrgProject): boolean =>
  toggled.value[group.project.key] ?? ((!!group.mark && FOR_YOU.includes(group.mark)) || holdsInView(group));
const isUnfolded = (key: string): boolean => toggled.value[key] ?? false;

interface Lines<T> {
  open: T[];
  done: T[];
  fold: string;
  keyOf: (one: T) => string;
}

type Line<T> = { key: string; item: T } | { key: string; fold: number };

const linesOf = <T,>({ open, done, fold, keyOf }: Lines<T>): Line<T>[] => [
  ...open.map((item) => ({ key: keyOf(item), item })),
  ...(done.length ? [{ key: fold, fold: done.length }] : []),
  ...(isUnfolded(fold) ? done.map((item) => ({ key: keyOf(item), item })) : []),
];

const slugOf = (one: OrgTask): string => one.meta.slug;
const keyOfRow = (row: OrgConversation): string => row.key;
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

const isHome = (group: OrgProject, row: OrgConversation): boolean =>
  group.conversations.some((one) => one.key === row.key);

const over = (event: DragEvent, group: OrgProject): void => {
  const row = carried.value;
  if (row && !isOpen(group)) toggled.value = { ...toggled.value, [group.project.key]: true };
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
      <template v-if="tree.inbox.length || desk.isNaming">
        <span class="section mono-meta">Backlog</span>
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
          <UiIconButton
            class="delete"
            :icon="Trash2"
            aria-label="Delete"
            data-tip="Delete it. Undo, or ⌘Z, brings it back"
            size="xs"
            @click="desk.remove(one)"
          />
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
          <span v-if="hot === group.project.key" class="drop mono-meta">{{
            carried ? `as [${group.project.token}]` : "to its Project Lead"
          }}</span>
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
            v-for="line in linesOf({
              open: group.tasks,
              done: group.done,
              fold: `tasks:${group.project.key}`,
              keyOf: slugOf,
            })"
            :key="line.key"
          >
            <button
              v-if="'fold' in line"
              class="fold plain-button focusable"
              data-depth="1"
              type="button"
              :aria-expanded="isUnfolded(line.key)"
              @click="toggle(line.key, isUnfolded(line.key))"
            >
              <span class="guide" aria-hidden="true" />
              <UiIcon :icon="isUnfolded(line.key) ? ChevronDown : ChevronRight" size="xs" />
              <span class="mono-meta">{{ plural(line.fold, "done task") }}</span>
            </button>
            <template v-else>
              <OrgRow
                class="landing"
                :attach="line.item.lead"
                :attach-tip="leadTip(line.item)"
                :data-hot="hotTask === line.item.meta.slug"
                :depth="1"
                is-task
                :is-selected="line.item.meta.slug === task.slug"
                :mark="line.item.mark"
                :name="line.item.meta.title || deslug(line.item.meta.slug)"
                @dragleave="hotTask = undefined"
                @dragover="overTask($event, line.item)"
                @drop="dropOnTask($event, line.item)"
                @open="task.show({ slug: line.item.meta.slug })"
              >
                <span v-if="hotTask === line.item.meta.slug" class="drop mono-meta">as its Task Lead</span>
                <template v-if="line.item.meta.task.state === 'done'" #after>
                  <UiIconButton
                    :icon="X"
                    aria-label="Remove from the list"
                    data-tip="Remove from the list. It goes by itself a day after Done"
                    size="xs"
                    @click.stop="desk.hide(line.item.meta)"
                  />
                </template>
              </OrgRow>
              <template
                v-for="lead in linesOf({
                  open: line.item.leads,
                  done: line.item.done,
                  fold: `done:${line.item.meta.slug}`,
                  keyOf: keyOfRow,
                })"
                :key="lead.key"
              >
                <button
                  v-if="'fold' in lead"
                  class="fold plain-button focusable"
                  data-depth="2"
                  type="button"
                  :aria-expanded="isUnfolded(lead.key)"
                  @click="toggle(lead.key, isUnfolded(lead.key))"
                >
                  <span class="guide" aria-hidden="true" />
                  <span class="guide deep" aria-hidden="true" />
                  <UiIcon :icon="isUnfolded(lead.key) ? ChevronDown : ChevronRight" size="xs" />
                  <span class="mono-meta">{{ lead.fold }} done</span>
                </button>
                <template v-else>
                  <OrgRow
                    :attach="lead.item.key"
                    :depth="2"
                    :is-front="front(lead.item)"
                    :mark="lead.item.mark"
                    :name="lead.item.name"
                    :role="lead.item.role"
                    :tip="lead.item.title"
                    @open="openConversation(lead.item)"
                  />
                  <div
                    v-if="lead.item.agents?.length"
                    class="hired"
                    role="group"
                    :aria-label="`Specialists ${lead.item.name} hired`"
                  >
                    <span class="guide" aria-hidden="true" />
                    <span class="guide deep" aria-hidden="true" />
                    <span
                      v-for="agent in lead.item.agents"
                      :key="agent.name"
                      class="hire mono-meta"
                      :data-tip="`A specialist ${lead.item.name} hired`"
                      ><span class="square" :data-tint="agentTint(agent.color, agent.name)" />{{ agent.name }}</span
                    >
                  </div>
                </template>
              </template>
            </template>
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

.delete {
  @apply flex-none opacity-0 transition-opacity duration-(--duration-fast) ease-out focus-visible:opacity-100;
}

.inbox:hover .delete,
.inbox[data-selected="true"] .delete {
  @apply opacity-100;
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

.fold .guide.deep,
.hired .guide.deep {
  @apply left-10;
}

.hired {
  @apply relative flex flex-wrap items-center gap-1 pt-0.5 pr-1 pb-1 pl-17;
}

.hired .guide {
  @apply absolute -top-px -bottom-px left-2.25 w-px origin-left scale-x-50 bg-border;
}

.hire {
  @apply inline-flex items-center gap-1 rounded-full border border-border px-1.75 py-px text-muted normal-case;
}
</style>
