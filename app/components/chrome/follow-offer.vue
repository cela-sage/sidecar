<script lang="ts" setup>
import { ArrowRight, X } from "@lucide/vue";
import type { FollowSource } from "~~/shared/types/review";

const WHY: Record<FollowSource, string> = {
  claude: "Claude opened",
  none: "Moved to",
  prompt: "You're typing in",
  terminal: "Terminal switched to",
};

const sc = useSidecar();
const follow = $follow();

const session = computed(() => sc.sessions.value.find((one) => one.key === follow.offer?.key));
const title = computed(() => (session.value ? nameOf(session.value) : (follow.offer?.name ?? follow.offer?.key ?? "")));
const place = computed(() => session.value && placeOf(session.value));
const ago = computed(() => session.value && ageOf(session.value));
const tint = computed(() => tintOf(session.value?.color, follow.offer?.key ?? ""));
</script>

<template>
  <UiSurface
    v-if="follow.offer"
    v-island-pop="'bottom left'"
    class="offer"
    data-region="follow-offer"
    pad="none"
    shape="island"
    variant="raised"
    role="status"
    aria-live="polite"
  >
    <button v-press class="go" type="button" @click="follow.accept()">
      <span class="why mono-meta">{{ WHY[follow.offer.source] }}</span>
      <span class="name">
        <span class="dot" :data-live="session?.live ?? false" :data-tint="tint" />
        <span class="title">{{ title }}</span>
      </span>
      <span v-if="place" class="place mono-meta">{{ place }}</span>
      <span v-if="session?.detail" class="about">{{ session.detail }}</span>
      <span class="foot">
        <span class="cta">Switch <UiIcon :icon="ArrowRight" size="sm" /></span>
        <span v-if="ago" class="ago mono-meta">{{ ago }}</span>
      </span>
    </button>
    <UiIconButton class="close" :icon="X" label="Dismiss" size="xs" @click="follow.decline()" />
  </UiSurface>
</template>

<style scoped>
.offer {
  @apply relative w-64;
}

.go {
  @apply flex w-full cursor-pointer flex-col gap-1.5 rounded-3xl border-0 bg-transparent p-4 text-left text-fg outline-none;
}

.go:focus-visible {
  @apply focus-ring;
}

.why {
  @apply pr-6 text-subtle;
}

.name {
  @apply flex min-w-0 items-start gap-2.5;
}

.dot {
  @apply mt-1.75 size-2 flex-none rounded-full bg-tint opacity-40;
}

.dot[data-live="true"] {
  @apply opacity-100;
}

.title {
  @apply line-clamp-2 min-w-0 typo-body-strong font-bold;
}

.place {
  @apply truncate pl-4.5 text-muted normal-case;
}

.about {
  @apply line-clamp-3 pl-4.5 typo-body text-muted;
}

.foot {
  @apply mt-1.5 flex items-center justify-between border-t border-t-border pt-2.5;
}

.cta {
  @apply inline-flex items-center gap-1 typo-body-strong text-primary;
}

.ago {
  @apply text-subtle;
}

.close {
  @apply absolute top-3 right-3;
}
</style>
