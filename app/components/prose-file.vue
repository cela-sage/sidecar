<script lang="ts">
const sizes = new Map<string, number | false>();
</script>

<script lang="ts" setup>
import { FileAudio, FileImage, FileText, FileVideo } from "@lucide/vue";
import type { Component } from "vue";
import type { FileContent, FileStat } from "~~/shared/types/files";

const { path } = defineProps<{ path: string }>();

const DWELL_MS = 350;
const CARD_W = 320;
const EXCERPT_LINES = 10;
const ICONS: Partial<Record<string, Component>> = { audio: FileAudio, image: FileImage, video: FileVideo };

const conversation = inject(proseConversation, undefined);
const sc = useSidecar();
const links = useLinks();
const fileMenu = $fileMenu();
const chip = useTemplateRef<HTMLElement>("chip");
const isFile = ref(false);
const size = ref(0);
const excerpt = ref("");
const hasRead = ref(false);
const at = ref<{ left: number; top: number }>();
let dwell: ReturnType<typeof setTimeout> | undefined;

const cwd = computed(() => sc.sessions.value.find((one) => one.key === conversation)?.cwd);
const absolute = computed(() => FileRefs.absolute({ path, cwd: cwd.value }));
const kind = computed(() => FileKind.of(path));
const icon = computed(() => (kind.value && ICONS[kind.value]) || FileText);
const name = computed(() => basename(path));
const folder = computed(() =>
  absolute.value ? homePath(absolute.value.slice(0, absolute.value.lastIndexOf("/"))) : "",
);
const src = computed(() =>
  conversation && absolute.value ? Preview.srcOf({ conversation, path: absolute.value }) : undefined,
);
const isText = computed(() => !kind.value || kind.value === "markdown");

const routeOf = (route: string): string => `/api/sessions/${encodeURIComponent(conversation ?? "")}/files/${route}`;

const statOf = async (found: string): Promise<number | false> => {
  const stat = await $fetch<FileStat>(routeOf("stat"), { query: { path: found } }).catch(() => undefined);
  return stat && "size" in stat ? (stat.size ?? 0) : false;
};

watch(
  absolute,
  async (found) => {
    if (!conversation || !found) return;
    const key = `${conversation}\n${found}`;
    if (!sizes.has(key)) sizes.set(key, await statOf(found));
    const got = sizes.get(key);
    isFile.value = typeof got === "number";
    size.value = typeof got === "number" ? got : 0;
  },
  { immediate: true },
);

const read = async (): Promise<void> => {
  if (!absolute.value || !isText.value || hasRead.value) return;
  hasRead.value = true;
  const got = await $fetch<FileContent>(routeOf("content"), { query: { path: absolute.value } }).catch(() => undefined);
  excerpt.value = got && "text" in got ? got.text.split("\n").slice(0, EXCERPT_LINES).join("\n") : "";
};

const peek = (): void => {
  const box = chip.value?.getBoundingClientRect();
  if (!box) return;
  at.value = { left: Math.max(8, Math.min(box.left - 6, window.innerWidth - CARD_W - 8)), top: box.top - 8 };
  void read();
};

const enter = (): void => {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  dwell = setTimeout(peek, DWELL_MS);
};

const leave = (): void => {
  clearTimeout(dwell);
  at.value = undefined;
};

const open = (): void => {
  leave();
  if (absolute.value) void links.open(absolute.value);
};

const menuFor = (event: MouseEvent): void => {
  leave();
  if (absolute.value) fileMenu.openFor(event, absolute.value);
};

onScopeDispose(leave);
</script>

<template>
  <span v-if="isFile" ref="chip" class="file" @contextmenu.prevent="menuFor" @mouseenter="enter" @mouseleave="leave">
    <button class="open plain-button focusable" type="button" @click="open">
      <UiIcon class="icon" :icon="icon" size="xs" />
      <span class="name">{{ name }}</span>
    </button>
    <Teleport to="body">
      <Transition name="peek">
        <span v-if="at" class="peek" role="tooltip" :style="{ left: `${at.left}px`, top: `${at.top}px` }">
          <img v-if="kind === 'image'" alt="" class="shot" :src="src" />
          <pre v-else-if="excerpt" class="excerpt">{{ excerpt }}</pre>
          <span class="head">
            <UiIcon class="icon" :icon="icon" size="xs" />
            <span class="words">
              <span class="title">{{ name }}</span>
              <span class="where mono-meta">{{ folder }}</span>
            </span>
            <span class="meta mono-meta">{{ sizeLabel(size) }}</span>
          </span>
        </span>
      </Transition>
    </Teleport>
  </span>
  <span v-else><slot /></span>
</template>

<style scoped>
.file {
  @apply relative -top-px inline-flex h-5.5 items-center rounded-full border border-border bg-raised py-0 pr-1 pl-1.5 align-middle leading-none transition-colors duration-(--duration-fast) ease-out;
  max-width: min(100%, --spacing(68));
}

@media (hover: hover) and (pointer: fine) {
  .file:hover {
    @apply border-border-strong bg-sunken;
  }
}

.open {
  @apply inline-flex min-w-0 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-fg;
}

.icon {
  @apply flex-none text-muted;
}

.name {
  @apply min-w-0 truncate typo-caption font-semibold;
}

.peek {
  @apply pointer-events-none fixed z-40 flex w-80 -translate-y-full flex-col overflow-hidden rounded-xl border border-border bg-raised text-left shadow-lg;
}

.shot {
  @apply max-h-48 w-full border-b border-b-border bg-canvas object-contain;
}

.excerpt {
  @apply m-0 max-h-40 overflow-hidden border-b border-b-border bg-sunken px-3 py-2 typo-mono-micro font-mono whitespace-pre text-muted;
}

.head {
  @apply flex min-w-0 items-center gap-2.5 px-3 py-2.5;
}

.words {
  @apply flex min-w-0 flex-1 flex-col gap-0.75;
}

.title {
  @apply truncate typo-caption font-bold text-fg;
}

.where {
  @apply truncate text-muted normal-case;
}

.meta {
  @apply flex-none text-muted;
}

.peek-enter-active,
.peek-leave-active {
  @apply transition-opacity duration-(--duration-fast) ease-out;
}

.peek-enter-from,
.peek-leave-to {
  @apply opacity-0;
}

@media (prefers-reduced-motion: reduce) {
  .peek-enter-active,
  .peek-leave-active {
    @apply transition-none;
  }
}
</style>
