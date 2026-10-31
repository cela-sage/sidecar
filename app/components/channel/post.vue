<script lang="ts" setup>
import { Bell, Check, CornerDownRight } from "@lucide/vue";
import type { PostItem } from "~/utils/channel-view";

const { isFocused = false, isPane = false, item } = defineProps<{
  isFocused?: boolean;
  isPane?: boolean;
  item: PostItem;
}>();
const emit = defineEmits<{ thread: [id: string] }>();

const replies = computed(() => (item.thread?.count === 1 ? "1 reply" : `${item.thread?.count ?? 0} replies`));
</script>

<template>
  <article class="post" :data-focused="isFocused" :data-pane="isPane" :data-raise="item.raise">
    <ChannelFace class="avatar" is-openable :size="isPane ? 32 : 36" :speaker="item.speaker" />
    <div class="body">
      <div class="head">
        <span class="name" :data-killed="item.speaker.isKilled" :data-tip="ChannelCast.tipOf(item.speaker)">{{
          item.speaker.name
        }}</span>
        <span v-if="item.speaker.role" class="role">{{ item.speaker.role }}</span>
        <time class="at" :datetime="item.at">{{ clockOf(item.at) }}</time>
      </div>
      <button
        v-if="item.replyTo && !isPane"
        class="reply-to plain-button focusable"
        data-tip="Open the thread"
        type="button"
        @click="emit('thread', item.replyTo.id)"
      >
        <UiIcon :icon="CornerDownRight" size="xs" /><span class="reply-to-lead">replied to a thread:</span
        ><span class="reply-to-text">{{ item.replyTo.text }}</span>
      </button>
      <p class="text">
        <template v-for="(one, at) in item.segments" :key="at"
          ><span v-if="one.tone" class="mention" :data-tip="one.tip" :data-tone="one.tone">{{ one.text }}</span
          ><template v-else>{{ one.text }}</template></template
        >
      </p>
      <p v-if="item.reach" class="reach"><UiIcon :icon="Bell" size="xs" />{{ item.reach }}</p>
      <p v-if="item.isBroadcast && isPane" class="reach"><UiIcon :icon="CornerDownRight" size="xs" />Also sent to the channel</p>
      <div v-for="one in item.outside" :key="one.key" class="token">
        <span class="token-title">{{ one.name }} gets one read, and picks what to spend it on</span>
        <div class="choices">
          <span class="choice" :data-on="false">
            <span class="choice-name">This message</span>
            <span class="choice-meta">1 message</span>
          </span>
          <span class="choice" :data-on="!!one.read">
            <span class="choice-name"><UiIcon v-if="one.read" :icon="Check" size="xs" />The channel up to here</span>
            <span class="choice-meta">{{
              one.read
                ? `${plural(one.lines, "message")} · ${one.name} read it at ${clockOf(one.read)}`
                : plural(one.lines, "message")
            }}</span>
          </span>
        </div>
      </div>
      <div v-if="item.raise === 'waiting'" class="raised">
        <span class="raised-mark"><OrgMark mark="raised" />{{ isPane ? `Raised to you · ${clockOf(item.at)}` : "Raised to you" }}</span>
        <UiButton
          v-if="!isPane"
          :data-tip="`${item.speaker.name} picks your reply up`"
          size="xs"
          variant="outline"
          @click="emit('thread', item.id)"
          >Reply in thread</UiButton
        >
      </div>
      <span v-else-if="item.raise === 'answered'" class="answered"
        ><UiIcon :icon="Check" size="xs" />Answered by you · {{ clockOf(item.answered) }}</span
      >
      <button
        v-if="item.thread && !isPane"
        class="thread plain-button focusable"
        data-tip="Open the thread"
        type="button"
        @click="emit('thread', item.id)"
      >
        <span class="stack">
          <ChannelFace v-for="who in item.thread.who" :key="who.key" is-stacked :size="20" :speaker="who" />
        </span>
        <span class="count" :data-waiting="item.thread.isWaiting">{{ replies }}</span>
        <span class="last">Last reply {{ clockOf(item.thread.last) }}</span>
      </button>
    </div>
  </article>
</template>

<style scoped>
.post {
  @apply grid grid-cols-[--spacing(9)_minmax(0,1fr)] gap-x-2.5 px-5 py-2;
}

.post[data-pane="true"] {
  @apply grid-cols-[--spacing(8)_minmax(0,1fr)] px-4;
}

.post[data-focused="true"] {
  @apply mx-2.5 rounded-box bg-sunken px-2.5;
}

.post[data-raise="waiting"] {
  @apply mx-2.5 rounded-box bg-error-soft px-2.5;
}

.post[data-raise="waiting"][data-pane="true"] {
  @apply mx-1.5;
}

.post[data-raise="waiting"][data-focused="true"] {
  @apply ring-2 ring-error/45 ring-inset;
}

.avatar {
  @apply justify-self-end pt-0.5;
}

.body {
  @apply flex min-w-0 flex-col gap-0.75;
}

.head {
  @apply flex flex-wrap items-baseline gap-1.75;
}

.name {
  @apply typo-body font-extrabold tracking-tight text-fg;
}

.name[data-killed="true"] {
  @apply text-muted;
}

.role {
  @apply flex-none rounded-sm bg-sunken px-1.25 py-px typo-mono-pico font-semibold tracking-wide text-muted;
}

.at {
  @apply typo-mono-micro text-subtle;
}

.text {
  @apply m-0 typo-body leading-relaxed text-pretty whitespace-pre-wrap text-fg;
}

.reply-to {
  @apply flex min-w-0 items-center gap-1.5 self-start border-0 bg-transparent p-0 text-left typo-caption text-muted;
}

.reply-to-lead {
  @apply flex-none;
}

.reply-to-text {
  @apply min-w-0 truncate text-primary-deep;
}

@media (hover: hover) and (pointer: fine) {
  .reply-to:hover .reply-to-text {
    @apply underline underline-offset-2;
  }
}

.mention {
  @apply rounded-sm bg-primary-soft px-0.75 font-semibold text-primary-deep;
}

.mention[data-tone="boss"] {
  @apply bg-error-soft text-error;
}

.mention[data-tone="out"] {
  @apply bg-sunken text-fg;
}

.reach {
  @apply m-0 flex items-center gap-1.5 typo-mono-micro font-medium tracking-wide text-muted;
}

.token {
  @apply mt-1.5 flex max-w-130 flex-col gap-2 rounded-xl border border-border bg-canvas px-3 pt-2.5 pb-3;
}

.token-title {
  @apply typo-caption-strong text-fg;
}

.choices {
  @apply grid grid-cols-2 gap-1.5;
}

.choice {
  @apply flex flex-col gap-0.75 rounded-lg border border-border bg-raised px-2.5 py-2;
}

.choice[data-on="true"] {
  @apply border-border-strong;
}

.choice-name {
  @apply flex items-center gap-1.5 typo-caption-medium text-muted;
}

.choice[data-on="true"] .choice-name {
  @apply text-fg;
}

.choice-meta {
  @apply typo-mono-micro text-muted;
}

.raised {
  @apply mt-1 flex items-center gap-2.5;
}

.raised-mark {
  @apply inline-flex items-center gap-1.5 typo-mono-micro font-semibold tracking-wide text-error;
}

.answered {
  @apply mt-0.5 inline-flex items-center gap-1.5 typo-caption-strong text-fg;
}

.thread {
  @apply -ml-1.5 inline-flex h-7.5 items-center gap-2 self-start rounded-lg border border-transparent bg-transparent pr-2.5 pl-1.5 transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .thread:hover {
    @apply border-border bg-raised;
  }
}

.stack {
  @apply inline-flex items-center;
}

.stack > :not(:first-child) {
  @apply -ml-1.5;
}

.count {
  @apply typo-caption-strong whitespace-nowrap text-primary-deep;
}

.count[data-waiting="true"] {
  @apply text-error;
}

.last {
  @apply typo-caption whitespace-nowrap text-muted;
}

@media (prefers-reduced-motion: reduce) {
  .thread {
    @apply transition-none;
  }
}
</style>
