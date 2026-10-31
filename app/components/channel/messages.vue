<script lang="ts" setup>
import { Archive } from "@lucide/vue";
import type { TaskMeta } from "~/utils/tasks";

const { meta } = defineProps<{ meta?: TaskMeta }>();

const channel = $channel();
const desk = $desk();

const items = computed(() =>
  channel.room ? ChannelView.streamOf(channel.room, channel.cast, channel.since) : [],
);
const closed = computed(() => (channel.room ? ChannelView.closedOf(channel.room, channel.cast) : ""));

const open = (id: string): void => {
  channel.thread = id;
};
</script>

<template>
  <div class="messages">
    <div class="column">
      <div class="scroll">
        <div class="log" role="log" aria-label="Messages" data-region="channel-log">
          <UiStateMessage v-if="channel.room && !items.length" align="center" class="empty"
            >Nothing here yet. The kickoff and every agent spawned for this workstream land here.</UiStateMessage
          >
          <template v-for="item in items" :key="item.id">
            <ChannelPost
              v-if="item.kind === 'post'"
              :is-focused="item.id === channel.thread"
              :item="item"
              @thread="open"
            />
            <ChannelLine v-else-if="item.kind === 'system'" :item="item" />
            <div v-else class="divider" role="separator">{{ item.text }}</div>
          </template>
        </div>
      </div>
      <div v-if="channel.room?.archived" class="closed">
        <UiIcon class="closed-icon" :icon="Archive" size="md" />
        <span class="closed-text">{{ closed }}</span>
        <UiButton
          v-if="meta"
          data-tip="Brings the workstream and its channel back. Its agents stay killed"
          size="xs"
          variant="outline"
          @click="desk.restore(meta)"
          >Restore</UiButton
        >
      </div>
      <div v-else-if="channel.room" class="foot" :data-pane="!!channel.thread">
        <ChannelComposer :placeholder="`Message #${channel.room.slug}`" />
      </div>
    </div>
    <ChannelThread v-if="channel.thread" :root="channel.thread" />
  </div>
</template>

<style scoped>
.messages {
  @apply flex min-h-0 flex-1;
}

.column {
  @apply flex min-w-0 flex-1 flex-col;
}

.scroll {
  @apply flex min-h-0 flex-1 flex-col-reverse overflow-y-auto;
}

.log {
  @apply flex flex-col pt-3 pb-2.5;
}

.empty {
  @apply py-10;
}

.divider {
  @apply flex items-center gap-3 px-5 py-2.5 typo-mono-micro font-medium tracking-widest text-error before:h-px before:flex-1 before:bg-error/40 before:content-[''] after:h-px after:flex-1 after:bg-error/40 after:content-[''];
}

/* Clear of the door's pill, which floats over the panel's bottom right unless the thread pane takes that corner. */
.foot {
  @apply flex-none pr-34 pb-(--float-clear) pl-5;
}

.foot[data-pane="true"] {
  @apply pr-5;
}

.closed {
  @apply mr-34 mb-(--float-clear) ml-5 flex flex-none items-center gap-3 rounded-2xl bg-sunken py-3 pr-3 pl-4;
}

.closed-icon {
  @apply flex-none text-muted;
}

.closed-text {
  @apply min-w-0 flex-1 typo-body text-pretty;
}
</style>
