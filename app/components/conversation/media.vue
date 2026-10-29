<script lang="ts">
export interface ChatMedia {
  path: string;
  kind: "image" | "video" | "audio";
  src: string;
  size: number;
}

const UNITS = [
  { unit: "byte", from: 1 },
  { unit: "kilobyte", from: 1024 },
  { unit: "megabyte", from: 1024 * 1024 },
  { unit: "gigabyte", from: 1024 * 1024 * 1024 },
] as const;
</script>

<script lang="ts" setup>
import { FileAudio, FileImage, FileVideo, Pause, Play } from "@lucide/vue";
import type { Component } from "vue";

const { media } = defineProps<{ media: ChatMedia }>();

const BARS = 120;
const ICONS: Record<ChatMedia["kind"], Component> = { audio: FileAudio, image: FileImage, video: FileVideo };

const links = useLinks();
const player = useTemplateRef<HTMLMediaElement>("player");
const duration = ref(0);
const time = ref(0);
const isPlaying = ref(false);
const bars = ref<number[]>([]);

const meta = computed(() => {
  const { unit, from } = UNITS.findLast((one) => media.size >= one.from) ?? UNITS[0];
  const amount = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: from >= 1024 * 1024 ? 1 : 0,
    style: "unit",
    unit,
    unitDisplay: "short",
  }).format(media.size / from);
  return `${FileKind.extensionOf(media.path).toUpperCase()} · ${amount}`;
});
const progress = computed(() => (duration.value ? time.value / duration.value : 0));
const played = computed(() => Math.round(progress.value * bars.value.length));

const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

const toggle = (): void => {
  const element = player.value;
  if (!element) return;
  if (element.paused) void element.play().catch(() => undefined);
  else element.pause();
};

const seek = (event: MouseEvent): void => {
  const element = player.value;
  const track = event.currentTarget;
  if (!element || !duration.value || !(track instanceof HTMLElement)) return;
  const box = track.getBoundingClientRect();
  element.currentTime = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1) * duration.value;
};

const heard = (): void => {
  const element = player.value;
  if (!element) return;
  time.value = element.currentTime;
  duration.value = Number.isFinite(element.duration) ? element.duration : 0;
  isPlaying.value = !element.paused && !element.ended;
};

// An offline context, since a live one created without a gesture warns in the console.
const waveOf = async (body: ArrayBuffer): Promise<number[]> => {
  const decoded = await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(body);
  const samples = decoded.getChannelData(0);
  const step = Math.max(1, Math.floor(samples.length / BARS));
  const peaks = Array.from({ length: BARS }, (_, at) => {
    let peak = 0;
    for (let index = at * step; index < Math.min((at + 1) * step, samples.length); index++)
      peak = Math.max(peak, Math.abs(samples[index] ?? 0));
    return peak;
  });
  const top = Math.max(...peaks, 0.0001);
  return peaks.map((peak) => Math.max(0.12, peak / top));
};

onMounted(async () => {
  if (media.kind !== "audio") return;
  const body = await fetch(media.src)
    .then((reply) => (reply.ok ? reply.arrayBuffer() : undefined))
    .catch(() => undefined);
  bars.value = body
    ? await waveOf(body).catch(() => Array.from({ length: BARS }, () => 0.12))
    : Array.from({ length: BARS }, () => 0.12);
});
</script>

<template>
  <figure class="media" :data-kind="media.kind">
    <figcaption class="caption">
      <a class="path" data-tip="Open in Files" :href="media.path" @click.prevent="links.open(media.path)">
        <UiIcon class="kind" :icon="ICONS[media.kind]" size="xs" />
        <span class="name">{{ media.path }}</span>
      </a>
      <span class="meta">{{ meta }}</span>
    </figcaption>

    <div v-if="media.kind === 'image'" class="picture">
      <img :alt="media.path" class="image" :src="media.src" />
    </div>

    <div v-else-if="media.kind === 'video'" class="screen">
      <video
        ref="player"
        class="video"
        playsinline
        preload="metadata"
        :src="`${media.src}#t=0.1`"
        @click="toggle"
        @ended="heard"
        @loadedmetadata="heard"
        @pause="heard"
        @play="heard"
        @timeupdate="heard"
      />
      <button
        v-if="!isPlaying"
        class="big-play plain-button focusable"
        aria-label="Play"
        data-tip="Play"
        type="button"
        @click="toggle"
      >
        <UiIcon :icon="Play" size="md" />
      </button>
      <div class="controls">
        <button
          class="small-play plain-button focusable"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          type="button"
          @click="toggle"
        >
          <UiIcon :icon="isPlaying ? Pause : Play" size="xs" />
        </button>
        <span class="track" aria-hidden="true" @click="seek"><span class="fill" :style="{ '--p': progress }" /></span>
        <span class="time">{{ clock(time) }} / {{ clock(duration) }}</span>
      </div>
    </div>

    <div v-else class="sound">
      <audio
        ref="player"
        preload="metadata"
        :src="media.src"
        @ended="heard"
        @loadedmetadata="heard"
        @pause="heard"
        @play="heard"
        @timeupdate="heard"
      />
      <button
        class="sound-play plain-button focusable"
        :aria-label="isPlaying ? 'Pause' : 'Play'"
        type="button"
        @click="toggle"
      >
        <UiIcon :icon="isPlaying ? Pause : Play" size="xs" />
      </button>
      <span class="wave" aria-hidden="true" @click="seek">
        <span v-for="(height, at) in bars" :key="at" class="bar" :data-played="at < played" :style="{ '--h': height }" />
      </span>
      <span class="time">{{ clock(isPlaying || time ? time : duration) }}</span>
    </div>
  </figure>
</template>

<style scoped>
.media {
  @apply m-0 flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-raised;
}

.caption {
  @apply flex h-8.5 min-w-0 items-center gap-2 border-b border-b-border px-3;
}

.path {
  @apply flex min-w-0 flex-1 items-center gap-1.75 font-mono typo-mono-micro font-medium text-fg no-underline;
}

@media (hover: hover) and (pointer: fine) {
  .path:hover .name {
    @apply underline underline-offset-3;
  }
}

.kind {
  @apply flex-none text-muted;
}

.name {
  @apply min-w-0 truncate;
}

.meta {
  @apply flex-none typo-mono-micro text-muted;
}

.picture {
  @apply flex h-48 items-center justify-center bg-canvas p-3.5;
}

.image {
  @apply block max-h-full max-w-full object-contain;
}

.screen {
  @apply relative h-48 overflow-hidden bg-sunken;
}

.video {
  @apply block size-full cursor-pointer object-cover;
}

.big-play {
  @apply absolute top-1/2 left-1/2 inline-flex size-11 -translate-1/2 items-center justify-center rounded-full border-0 bg-fg pl-0.5 text-canvas shadow-md;
}

.controls {
  @apply absolute right-2 bottom-2 left-2 flex h-7 items-center gap-2.5 rounded-full px-2 cela-glass;
}

.small-play {
  @apply inline-flex size-5 flex-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-fg;
}

.track {
  @apply relative h-0.75 flex-1 cursor-pointer overflow-hidden rounded-xs bg-border-strong;
}

.fill {
  @apply absolute inset-y-0 left-0 bg-fg;
  width: calc(var(--p) * 100%);
}

.time {
  @apply flex-none font-mono typo-mono-micro font-medium text-fg;
}

.sound {
  @apply flex h-13 items-center gap-3 pr-3.5 pl-2.5;
}

.sound-play {
  @apply inline-flex size-8 flex-none items-center justify-center rounded-full border-0 bg-fg pl-0.5 text-canvas;
}

.wave {
  @apply flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-0.5 overflow-hidden;
}

.bar {
  @apply w-0.75 flex-none rounded-xs bg-border-strong;
  height: calc(var(--h) * 100%);
}

.bar[data-played="true"] {
  @apply bg-fg;
}

.sound .time {
  @apply text-muted;
}
</style>
