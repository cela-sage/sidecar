<script lang="ts" setup>
import { X } from "@lucide/vue";
import { useEventListener } from "@vueuse/core";

const { root } = defineProps<{ root: string }>();

const channel = $channel();
const reply = useTemplateRef<{ focus: () => void }>("reply");

const items = computed(() => (channel.room ? ChannelView.paneOf(channel.room, channel.cast, root) : []));

const close = (): void => {
  channel.thread = undefined;
};

// Esc is read once the press is done, since the composer and the app's own handler claim theirs first.
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (event.key !== "Escape" || event.metaKey || event.ctrlKey || event.altKey) return;
  setTimeout(() => {
    if (!event.defaultPrevented) close();
  });
});

watch(
  () => root,
  () => void nextTick(() => reply.value?.focus()),
  { immediate: true },
);
</script>

<template>
  <aside class="thread" aria-label="Thread" data-region="channel-thread">
    <header class="head">
      <span class="title">Thread</span>
      <span class="where">#{{ channel.room?.slug }}</span>
      <span class="spacer" />
      <UiIconButton :icon="X" aria-label="Close" data-tip="Close · {esc}" size="xs" @click="close" />
    </header>
    <div class="scroll">
      <div class="log" role="log" aria-label="Replies">
        <template v-for="item in items" :key="item.id">
          <ChannelPost v-if="item.kind === 'post'" is-pane :item="item" />
          <ChannelLine v-else-if="item.kind === 'system'" :item="item" />
          <div v-else class="divider" role="separator">{{ item.text }}</div>
        </template>
      </div>
    </div>
    <ChannelComposer v-if="!channel.room?.archived" ref="reply" class="reply" placeholder="Reply…" :thread="root" />
  </aside>
</template>

<style scoped>
.thread {
  @apply flex min-h-0 w-100 flex-none flex-col border-l border-l-border bg-raised settle;
}

.head {
  @apply flex h-13 flex-none items-center gap-2.25 border-b border-b-border pr-2.5 pl-4;
}

.title {
  @apply typo-body-strong font-extrabold tracking-tight;
}

.where {
  @apply typo-mono-micro text-muted;
}

.spacer {
  @apply flex-1;
}

.scroll {
  @apply flex min-h-0 flex-1 flex-col-reverse overflow-y-auto;
}

.log {
  @apply flex flex-col py-2;
}

.divider {
  @apply flex items-center gap-3 px-4 py-2 typo-mono-micro font-medium tracking-widest text-muted after:h-px after:flex-1 after:bg-border after:content-[''];
}

.reply {
  @apply mx-4 mt-2 mb-(--float-clear) flex-none;
}
</style>
