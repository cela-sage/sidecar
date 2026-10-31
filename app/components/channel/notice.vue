<script lang="ts" setup>
import { X } from "@lucide/vue";

const boss = $bossNotice();
const field = useTemplateRef<HTMLElement>("field");

const where = computed(() =>
  boss.notice ? [boss.notice.project, `#${boss.notice.raise.slug}`].filter(Boolean).join(" · ") : "",
);

watch(
  () => boss.notice?.phase,
  (phase) => {
    if (phase === "replying") void nextTick(() => field.value?.querySelector("input")?.focus());
  },
);
</script>

<template>
  <Transition name="drop">
    <div v-if="boss.notice" class="notice" role="alert" aria-label="Raised to you" data-region="boss-notice">
      <div class="top">
        <ChannelFace :size="40" :speaker="boss.notice.from" />
        <div class="words">
          <div class="who">
            <span class="name">{{ boss.notice.from.name }}</span>
            <span class="where">{{ where }}</span>
            <time class="at" :datetime="boss.notice.at">{{ clockOf(boss.notice.at) }}</time>
          </div>
          <p class="text">
            <template v-for="(one, at) in boss.notice.segments" :key="at"
              ><span v-if="one.tone" class="mention" :data-tone="one.tone">{{ one.text }}</span
              ><template v-else>{{ one.text }}</template></template
            >
          </p>
        </div>
        <UiIconButton class="close" :icon="X" aria-label="Dismiss" data-tip="Dismiss" size="xs" @click="boss.dismiss()" />
      </div>
      <div v-if="boss.notice.phase === 'shown'" class="acts">
        <UiButton
          :data-tip="`Opens the channel on ${boss.notice.from.name}'s thread`"
          size="sm"
          variant="outline"
          @click="boss.open()"
          >Open</UiButton
        >
        <UiButton
          :data-tip="`Reply here, in ${boss.notice.from.name}'s thread`"
          size="sm"
          variant="outline"
          @click="boss.reply()"
          >Reply</UiButton
        >
      </div>
      <template v-else>
        <div ref="field" class="field">
          <UiTextInput
            v-model="boss.draft"
            :aria-label="`Reply to ${boss.notice.from.name}`"
            :disabled="boss.notice.phase === 'sending'"
            placeholder="Reply…"
            variant="bare"
            @keydown.enter.prevent="boss.send()"
          />
          <UiButton
            data-tip="Send · {enter}"
            :disabled="!boss.draft.trim() || boss.notice.phase === 'sending'"
            size="xs"
            @click="boss.send()"
            >Send</UiButton
          >
        </div>
        <span class="goes">Goes to {{ boss.notice.from.name }}'s thread in #{{ boss.notice.raise.slug }}.</span>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.notice {
  @apply fixed top-13.5 right-4 z-60 box-border flex w-95 flex-col gap-3 rounded-2xl border border-border bg-raised p-3 shadow-lg;
}

.top {
  @apply flex gap-2.75;
}

.words {
  @apply flex min-w-0 flex-1 flex-col gap-0.5;
}

.who {
  @apply flex items-baseline gap-1.75;
}

.name {
  @apply flex-none typo-caption-strong font-extrabold;
}

.where {
  @apply min-w-0 flex-1 truncate typo-caption text-muted;
}

.at {
  @apply flex-none typo-mono-micro text-muted;
}

.close {
  @apply -mt-1 -mr-1 flex-none;
}

.text {
  @apply m-0 typo-caption-medium text-pretty text-fg;
}

.mention {
  @apply rounded-sm bg-primary-soft px-0.75 font-semibold text-primary-deep;
}

.mention[data-tone="boss"] {
  @apply bg-error-soft text-error;
}

.acts {
  @apply grid grid-cols-2 gap-2;
}

.field {
  @apply flex h-9 items-center gap-2 rounded-field border border-primary bg-raised pr-1 pl-3 ring-3 ring-primary/18;
}

.field > :first-child {
  @apply min-w-0 flex-1;
}

.goes {
  @apply typo-caption text-muted;
}

.drop-enter-active {
  @apply transition-[opacity,transform] duration-(--duration-base) ease-out;
}

.drop-leave-active {
  @apply transition-[opacity,transform] duration-(--duration-press) ease-out;
}

.drop-enter-from,
.drop-leave-to {
  @apply -translate-y-2 scale-98 opacity-0;
}

@media (prefers-reduced-motion: reduce) {
  .drop-enter-from,
  .drop-leave-to {
    @apply translate-y-0 scale-100;
  }
}
</style>
