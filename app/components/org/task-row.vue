<script lang="ts" setup>
import { X } from "@lucide/vue";
import type { OrgConversation, OrgTask } from "~/utils/org";
import { tintOf as agentTint } from "~/utils/tint";

const { depth, isHot = false, one } = defineProps<{ depth: number; isHot?: boolean; one: OrgTask }>();
const emit = defineEmits<{
  open: [row: OrgConversation];
  over: [event: DragEvent];
  drop: [event: DragEvent];
  leave: [];
  menu: [event: MouseEvent];
}>();

const sc = useSidecar();
const task = $task();
const desk = $desk();
const conversationMenu = $conversationMenu();
const folds = useOrgFolds();

const lines = computed(() =>
  folds.linesOf({
    open: one.leads,
    done: one.done,
    fold: `done:${one.meta.slug}`,
    depth: depth + 1,
    keyOf: (row) => row.key,
  }),
);

const front = (row: OrgConversation): boolean => !task.slug && row.key === sc.sessionKey.value;
</script>

<template>
  <OrgDraft
    v-if="desk.renaming === one.meta.slug"
    action="Rename"
    :depth="depth"
    :initial="one.meta.title || deslug(one.meta.slug)"
    label="Rename the task"
    placeholder="The task's new title"
    tip="Rename, keeping its slug · {enter}"
    @cancel="desk.renaming = undefined"
    @name="desk.renameTask(one.meta, $event)"
  />
  <OrgRow
    v-else
    class="landing"
    :data-hot="isHot"
    :depth="depth"
    is-task
    :is-front="one.meta.slug === task.slug"
    :mark="one.mark"
    :name="one.meta.title || deslug(one.meta.slug)"
    @contextmenu.prevent="emit('menu', $event)"
    @dragleave="emit('leave')"
    @dragover="emit('over', $event)"
    @drop="emit('drop', $event)"
    @open="task.show({ slug: one.meta.slug })"
  >
    <span v-if="isHot" class="drop mono-meta">as its Individual Contributor</span>
    <template v-if="one.status === 'done'" #after>
      <UiIconButton
        :icon="X"
        aria-label="Remove from the list"
        data-tip="Remove from the list. It goes by itself a day after Done"
        size="xs"
        @click.stop="desk.hide(one.meta)"
      />
    </template>
  </OrgRow>
  <template v-for="line in lines" :key="line.key">
    <OrgFold v-if="'fold' in line" :depth="line.depth" :fold="line.key" :label="`${line.fold} done`" />
    <template v-else>
      <OrgRow
        :conversation="line.item.key"
        :depth="line.depth"
        :is-front="front(line.item)"
        :mark="line.item.mark"
        :name="line.item.name"
        :role="line.item.role"
        :tip="line.item.title"
        @contextmenu.prevent="
          conversationMenu.openFor($event, {
            key: line.item.key,
            title: line.item.title,
            open: () => emit('open', line.item),
          })
        "
        @open="emit('open', line.item)"
      />
      <div
        v-if="line.item.agents?.length"
        class="hired"
        role="group"
        :aria-label="`Specialists ${line.item.name} hired`"
        :data-depth="line.depth"
      >
        <OrgGuides :depth="line.depth" />
        <span
          v-for="agent in line.item.agents"
          :key="agent.name"
          class="hire mono-meta"
          :data-tip="`A specialist ${line.item.name} hired`"
          ><span class="square" :data-tint="agentTint(agent.color, agent.name)" />{{ agent.name }}</span
        >
      </div>
    </template>
  </template>
</template>

<style scoped>
.landing[data-hot="true"] {
  @apply bg-primary-soft outline-2 outline-offset-1 outline-primary outline-dashed;
}

.drop {
  @apply flex-none text-primary-deep normal-case;
}

.hired {
  @apply relative flex flex-none flex-wrap items-center gap-1 pt-0.5 pr-1 pb-1 pl-17;
}

.hired[data-depth="3"] {
  @apply pl-24;
}

.hired[data-depth="4"] {
  @apply pl-31;
}

.hire {
  @apply inline-flex items-center gap-1 rounded-full border border-border px-1.75 py-px text-muted normal-case;
}

.square {
  @apply size-1.75 flex-none rounded-xs bg-tint;
}
</style>
