<script lang="ts" setup>
import { ChevronDown, ChevronRight } from "@lucide/vue";
import type { TaskGroup, TaskMeta } from "~/utils/tasks";

const { active, group, lineOf, sentence } = defineProps<{
  active?: string;
  group: TaskGroup;
  lineOf: (meta: TaskMeta) => string;
  sentence?: string;
}>();

const sc = useSidecar();
const task = $task();
const desk = $desk();
const root = useTemplateRef<HTMLElement>("root");
const isHot = ref(false);

const counts = computed(() => Tasks.countsOf(group.tasks));
const isOpen = computed(() => task.isGroupOpen(group));
const dragged = computed(() => Tasks.of(sc.catalogue.value).find((one) => one.slug === desk.dragging));

const over = (event: DragEvent): void => {
  if (!group.project || !dragged.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  isHot.value = true;
};

const leave = (event: DragEvent): void => {
  const to = event.relatedTarget;
  if (!(to instanceof Node) || !root.value?.contains(to)) isHot.value = false;
};

const drop = (event: DragEvent): void => {
  isHot.value = false;
  const meta = dragged.value;
  if (!group.project || !meta) return;
  event.preventDefault();
  desk.dragging = undefined;
  void desk.place(meta, group.project);
};
</script>

<template>
  <div
    ref="root"
    class="project"
    data-region="desk-project"
    :data-hot="isHot"
    @dragleave="leave"
    @dragover="over"
    @drop="drop"
  >
    <button class="head plain-button focusable" type="button" :aria-expanded="isOpen" @click="task.toggleGroup(group)">
      <span class="mark"><span class="square" :data-tint="group.tint" /></span>
      <span class="name">{{ group.name }}</span>
      <span class="counts">
        <span v-for="count in counts" :key="count.text" class="count mono-meta" :data-look="count.look">
          <TaskDot v-if="count.look" :look="count.look" size="sm" />{{ count.text }}
        </span>
        <span v-if="!counts.length" class="count mono-meta">nothing open</span>
      </span>
      <UiIcon class="chevron" :icon="isOpen ? ChevronDown : ChevronRight" size="xs" />
    </button>
    <p v-if="isHot" class="drop">Drop to hand it to {{ group.name }}'s Project Lead</p>
    <p v-else-if="sentence" class="sentence">{{ sentence }}</p>
    <template v-if="isOpen">
      <DeskTaskRow v-for="one in group.tasks" :key="one.slug" :active="active" :line="lineOf(one)" :meta="one" />
    </template>
  </div>
</template>

<style scoped>
.project {
  @apply relative -mx-2 flex flex-col gap-0.5 rounded-xl p-2 outline-2 outline-offset-2 outline-transparent transition-colors duration-(--duration-fast) ease-out;
}

.project[data-hot="true"] {
  @apply bg-primary-soft outline-primary outline-dashed;
}

.head {
  @apply flex w-full items-center gap-2.5 border-0 bg-transparent p-0 text-left text-fg;
}

.mark {
  @apply flex w-6 flex-none justify-center;
}

.square {
  @apply size-2.5 rounded-sm bg-tint;
}

.name {
  @apply min-w-0 flex-1 typo-body font-bold;
}

.counts {
  @apply inline-flex flex-none items-center gap-3;
}

.count {
  @apply inline-flex items-center gap-1.25 text-muted normal-case;
}

.count[data-look="running"] {
  @apply text-primary;
}

.count[data-look="needs"] {
  @apply text-error;
}

.chevron {
  @apply flex-none text-muted;
}

.sentence,
.drop {
  @apply m-0 pl-8.5 typo-body leading-snug text-pretty text-muted;
}

.drop {
  @apply font-semibold text-primary-deep;
}
</style>
