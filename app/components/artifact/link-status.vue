<script lang="ts" setup>
import type { LinkPreview } from "~~/shared/types/web";

const TAIL = 28;
// Long enough that sweeping the pointer across a page looks nothing up, short enough to feel like a hover.
const DWELL_MS = 350;

const sc = useSidecar();
const web = $web();
const artifact = $artifact();
const card = ref<LinkPreview>();
const hasShot = ref(false);
const looked = new Map<string, LinkPreview | false>();
let dwell: ReturnType<typeof setTimeout> | undefined;

const parts = computed(() => {
  const link = artifact.link ?? "";
  const cut = Math.max(Math.ceil(link.length / 2), link.length - TAIL);
  return { head: link.slice(0, cut), tail: link.slice(cut) };
});

async function lookUp(link: string): Promise<void> {
  const from = sc.artifact.value?.kind === "web" ? web.page?.url : undefined;
  const got = await $fetch<LinkPreview>("/api/web/preview", { query: { from, url: link } }).catch(() => undefined);
  looked.set(link, got ?? false);
  if (artifact.link === link) card.value = got;
}

watch(
  () => artifact.link,
  (link) => {
    clearTimeout(dwell);
    card.value = undefined;
    hasShot.value = false;
    if (!link || !/^https?:\/\//i.test(link)) return;
    const held = looked.get(link);
    if (looked.has(link)) card.value = held || undefined;
    else dwell = setTimeout(() => void lookUp(link), DWELL_MS);
  },
);

onScopeDispose(() => clearTimeout(dwell));
</script>

<template>
  <Transition name="status">
    <div v-if="artifact.link" class="status" data-region="link-status" :data-card="!!card" role="status">
      <div class="grow">
        <div class="inner">
          <template v-if="card">
            <img
              v-if="card.image"
              v-show="hasShot"
              alt=""
              class="shot"
              referrerpolicy="no-referrer"
              :src="card.image"
              @load="hasShot = true"
            />
            <span class="site">
              <WebFavicon class="icon" :address="card.url" />
              <span class="name">{{ card.site }}</span>
            </span>
            <span v-if="card.title" class="title">{{ card.title }}</span>
            <span v-if="card.description" class="about">{{ card.description }}</span>
          </template>
        </div>
      </div>
      <span class="address">
        <span class="head">{{ parts.head }}</span>
        <span class="tail">{{ parts.tail }}</span>
      </span>
    </div>
  </Transition>
</template>

<style scoped>
/* Sized by its content in both states, which interpolate-size lets the width ease between. */
.status {
  @apply pointer-events-none absolute bottom-[calc(var(--float-clear,0px)_+_--spacing(2))] left-2 z-29 flex w-fit max-w-[min(--spacing(150),calc(100%_-_--spacing(4)))] flex-col overflow-hidden rounded-field border border-border bg-raised shadow-sm transition-[width,border-radius,box-shadow] duration-(--duration-base) ease-out;
  interpolate-size: allow-keywords;
}

.status[data-card="true"] {
  @apply w-80 rounded-box shadow-md;
}

/* A 0fr row opening to 1fr is the one height transition that needs no measuring. */
.grow {
  @apply grid grid-rows-[0fr] transition-[grid-template-rows] duration-(--duration-base) ease-out;
}

.status[data-card="true"] .grow {
  @apply grid-rows-[1fr];
}

.inner {
  @apply flex min-h-0 flex-col gap-1 overflow-hidden opacity-0 transition-opacity duration-(--duration-base) ease-out;
}

.status[data-card="true"] .inner {
  @apply px-3 pt-3 pb-1 opacity-100;
}

.shot {
  @apply -mx-3 -mt-3 mb-1.5 aspect-[1.91] w-[calc(100%_+_--spacing(6))] max-w-none bg-sunken object-cover;
}

.site {
  @apply flex min-w-0 items-center gap-1.5 typo-caption text-muted;
}

.icon {
  @apply flex-none;
}

.name {
  @apply min-w-0 truncate;
}

.title {
  @apply line-clamp-2 typo-body-strong font-bold text-fg;
}

.about {
  @apply line-clamp-2 typo-caption text-muted;
}

/* The head gives way first and the tail never does, so a long link is cut in the middle with its file name in view. */
.address {
  @apply flex min-w-0 px-2 py-1 font-mono typo-meta-strong whitespace-pre text-muted;
}

.status[data-card="true"] .address {
  @apply px-3 pt-0 pb-2.5 text-subtle;
}

.head {
  @apply min-w-0 truncate;
}

.tail {
  @apply flex-none;
}

.status-enter-active {
  @apply transition-opacity delay-(--duration-fast) duration-(--duration-fast) ease-out;
}

.status-leave-active {
  @apply transition-opacity duration-(--duration-fast) ease-out;
}

.status-enter-from,
.status-leave-to {
  @apply opacity-0;
}

@media (prefers-reduced-motion: reduce) {
  .status,
  .grow,
  .inner,
  .status-enter-active,
  .status-leave-active {
    @apply transition-none;
  }
}
</style>
