<script lang="ts" setup>
import type { SessionAgent } from "~~/shared/types/session";
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

const rows = computed(() => (Workstreams.isArchived(one.status) ? [] : one.leads));

const front = (row: OrgConversation): boolean => !task.slug && row.key === sc.sessionKey.value;

const hireTip = ({ name, description, state }: SessionAgent): string =>
  [name, description, state === "killed" ? "killed" : undefined].filter(Boolean).join(" · ");
</script>

<template>
  <OrgDraft
    v-if="desk.renaming === one.meta.slug"
    action="Rename"
    :depth="depth"
    :initial="one.meta.title || deslug(one.meta.slug)"
    label="Rename the workstream"
    placeholder="The workstream's new title"
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
    <template v-if="Workstreams.isArchived(one.status)" #after>
      <UiButton
        class="restore"
        data-tip="Brings it back with its channel. Its agents stay killed"
        size="xs"
        variant="outline"
        @click.stop="desk.restore(one.meta)"
        >Restore</UiButton
      >
    </template>
  </OrgRow>
  <template v-for="row in rows" :key="row.key">
    <OrgRow
      :agent="row.agent"
      :conversation="row.key"
      :depth="depth + 1"
      :doing="row.doing"
      :is-front="front(row)"
      :mark="row.mark"
      :name="row.name"
      :role="row.role"
      :tip="row.title"
      @contextmenu.prevent="
        conversationMenu.openFor($event, {
          key: row.key,
          title: row.title,
          open: () => emit('open', row),
        })
      "
      @open="emit('open', row)"
    />
    <div
      v-if="row.agents?.length"
      class="hired"
      role="group"
      :aria-label="`Specialists ${row.name} hired`"
      :data-depth="depth + 1"
    >
      <OrgGuides :depth="depth + 1" />
      <span
        v-for="agent in row.agents"
        :key="agent.name"
        class="hire mono-meta"
        :data-state="agent.state"
        :data-tip="hireTip(agent)"
      >
        <OrgMark :mark="agent.state" />
        <span class="square" :data-tint="agentTint(agent.color, agent.name)" />{{ agent.name }}
      </span>
    </div>
  </template>
</template>

<style scoped>
.landing[data-hot="true"] {
  @apply bg-primary-soft outline-2 outline-offset-1 outline-primary outline-dashed;
}

.drop {
  @apply flex-none text-primary-deep normal-case;
}

.restore {
  @apply mr-0.5 flex-none;
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

.hire[data-state="killed"] {
  @apply text-subtle;
}

.hire[data-state="killed"] .square {
  @apply bg-subtle;
}
</style>
