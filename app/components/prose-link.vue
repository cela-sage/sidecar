<script lang="ts">
import type { LinkPreview } from "~~/shared/types/web";

const looked = new Map<string, LinkPreview | false>();
</script>

<script lang="ts" setup>
const { href, title } = defineProps<{ href?: string; title?: string }>();

const FILE = /\.(md|mdx|html?|tsx?|jsx?|mjs|cjs|vue|json|ya?ml|toml|sh|zsh|py|txt|css|lock)$/i;
const WEB = /^https?:\/\//i;
const DWELL_MS = 350;
const LEAVE_MS = 160;
const CARD_W = 340;

const links = useLinks();
const anchor = useTemplateRef<HTMLElement>("anchor");
const card = ref<LinkPreview>();
const at = ref({ left: 0, top: 0 });
const hasShot = ref(false);
let dwell: ReturnType<typeof setTimeout> | undefined;
let leave: ReturnType<typeof setTimeout> | undefined;

const host = computed(() => (href && WEB.test(href) && URL.canParse(href) ? new URL(href).hostname : undefined));
const isLocal = computed(
  () => !!host.value && /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(host.value),
);

// Linkify reads a bare name such as README.md as a host, so a link that is only its own text and ends like a file is a path.
const bareFileOf = (event: MouseEvent): string | undefined => {
  const text = event.currentTarget instanceof HTMLElement ? (event.currentTarget.textContent?.trim() ?? "") : "";
  return href && FILE.test(text) && href.replace(/^https?:\/\//i, "").replace(/\/$/, "") === text ? text : undefined;
};

// The href stays real so Copy link still gives it, and only the click is taken over.
function onClick(event: MouseEvent): void {
  if (!href || !links.owns(href)) return;
  event.preventDefault();
  card.value = undefined;
  void links.open(bareFileOf(event) ?? href);
}

const lookUp = async (link: string): Promise<LinkPreview | undefined> => {
  if (looked.has(link)) return looked.get(link) || undefined;
  const got = await $fetch<LinkPreview | undefined>("/api/web/preview", { query: { url: link } }).catch(() => undefined);
  looked.set(link, got ?? false);
  return got;
};

const show = async (): Promise<void> => {
  const link = href;
  if (!link || !host.value) return;
  const got = await lookUp(link);
  if (link !== href) return;
  const box = anchor.value?.getBoundingClientRect();
  if (!box) return;
  at.value = { left: Math.max(8, Math.min(box.left - 8, window.innerWidth - CARD_W - 8)), top: box.top - 8 };
  hasShot.value = false;
  card.value = got ?? (isLocal.value ? { site: host.value, url: link } : undefined);
};

const enter = (event: MouseEvent): void => {
  clearTimeout(leave);
  if (!host.value || card.value || bareFileOf(event)) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  dwell = setTimeout(() => void show(), DWELL_MS);
};

const away = (): void => {
  clearTimeout(dwell);
  leave = setTimeout(() => (card.value = undefined), LEAVE_MS);
};

const stay = (): void => clearTimeout(leave);

const openHere = (): void => {
  card.value = undefined;
  if (href) void links.open(href);
};

onScopeDispose(() => {
  clearTimeout(dwell);
  clearTimeout(leave);
});
</script>

<template>
  <a
    ref="anchor"
    :href="href"
    rel="noopener noreferrer"
    target="_blank"
    :title="title"
    @click="onClick"
    @mouseenter="enter"
    @mouseleave="away"
    ><slot
  /></a>
  <Teleport to="body">
    <Transition name="card">
      <div
        v-if="card"
        class="card"
        role="tooltip"
        :style="{ left: `${at.left}px`, top: `${at.top}px` }"
        @mouseenter="stay"
        @mouseleave="away"
      >
        <img
          v-if="card.image"
          v-show="hasShot"
          alt=""
          class="shot"
          referrerpolicy="no-referrer"
          :src="card.image"
          @load="hasShot = true"
        />
        <div class="row">
          <WebFavicon class="icon" :address="card.url" />
          <span class="words">
            <span class="title">{{ card.title || card.site }}</span>
            <span class="host">{{ card.url.replace(/^https?:\/\//, "") }}</span>
          </span>
          <UiButton
            v-if="isLocal"
            data-tip="Opens it as a Web entry in Artifacts"
            size="xs"
            variant="outline"
            @click="openHere"
            >Open in Artifacts</UiButton
          >
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.card {
  @apply fixed z-40 flex w-85 -translate-y-full flex-col overflow-hidden rounded-xl border border-border bg-raised text-left shadow-lg;
}

.shot {
  @apply aspect-[1.91] w-full border-b border-b-border bg-sunken object-cover;
}

.row {
  @apply flex min-w-0 items-center gap-2.5 py-2.5 pr-2.5 pl-3;
}

.icon {
  @apply flex-none;
}

.words {
  @apply flex min-w-0 flex-1 flex-col gap-0.75;
}

.title {
  @apply truncate typo-caption font-bold text-fg;
}

.host {
  @apply truncate font-mono typo-mono-micro text-muted;
}

.card-enter-active {
  @apply transition-opacity duration-(--duration-fast) ease-out;
}

.card-leave-active {
  @apply transition-opacity duration-(--duration-fast) ease-out;
}

.card-enter-from,
.card-leave-to {
  @apply opacity-0;
}

@media (prefers-reduced-motion: reduce) {
  .card-enter-active,
  .card-leave-active {
    @apply transition-none;
  }
}
</style>
