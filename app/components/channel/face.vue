<script lang="ts" setup>
import { User } from "@lucide/vue";
import type { AgentCardInfo } from "~/utils/agent-icons";
import type { Speaker } from "~/utils/channel-cast";

const {
  isOpenable = false,
  isStacked = false,
  size,
  speaker,
} = defineProps<{ isOpenable?: boolean; isStacked?: boolean; size: number; speaker: Speaker }>();

const nav = $nav();
const task = $task();
const tree = useOrgTree();

const card = computed((): AgentCardInfo | undefined => {
  if (!isOpenable || !speaker.face) return undefined;
  const row = Org.placeOf(tree.value, speaker.key)?.row;
  const project = task.projects.find((one) => one.token === speaker.token)?.name ?? speaker.token;
  return {
    name: speaker.name,
    work: speaker.work,
    mark: speaker.isKilled ? "killed" : (row?.mark ?? "completed"),
    ...(speaker.role ? { role: speaker.role } : {}),
    ...(project ? { project } : {}),
  };
});

const open = (): void => nav.go({ kind: "conversation", key: speaker.key });
</script>

<template>
  <button
    v-if="card && speaker.face"
    class="opens plain-button focusable"
    type="button"
    :aria-label="`Open ${speaker.name}'s conversation`"
    @click="open"
  >
    <OrgAgentIcon
      :card="card"
      :icon="speaker.face.icon"
      :is-killed="speaker.isKilled"
      :is-stacked="isStacked"
      :size="size"
      @open="open"
    />
  </button>
  <OrgAgentIcon
    v-else-if="speaker.face"
    :icon="speaker.face.icon"
    :is-killed="speaker.isKilled"
    :is-stacked="isStacked"
    :size="size"
  />
  <span
    v-else
    class="tile"
    role="img"
    :aria-label="speaker.name"
    :data-kind="speaker.kind"
    :data-killed="speaker.isKilled"
    :data-stacked="isStacked"
    :style="{ '--size': `${size}px` }"
  >
    <UiIcon v-if="speaker.kind === 'you'" :icon="User" size="sm" />
    <ClaudeMascot v-else-if="speaker.kind === 'assistant'" state="idle" :size="Math.round(size * 0.7)" />
    <template v-else>{{ speaker.name.charAt(0).toUpperCase() }}</template>
  </span>
</template>

<style scoped>
.opens {
  @apply inline-flex flex-none rounded-md border-0 bg-transparent p-0;
}

.tile {
  @apply inline-flex size-(--size) flex-none items-center justify-center rounded-md bg-sunken typo-caption-strong text-muted;
}

.tile[data-kind="you"] {
  @apply bg-fg text-canvas;
}

.tile[data-stacked="true"] {
  @apply ring-2 ring-raised;
}

.tile[data-killed="true"] {
  @apply opacity-50 grayscale;
}
</style>
