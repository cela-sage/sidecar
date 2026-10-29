<script lang="ts" setup>
type Axis = "x" | "y";

const size = defineModel<number>({ required: true });
const {
  axis = "x",
  edge = "start",
  initial,
  label,
  max = 640,
  min = 200,
} = defineProps<{
  axis?: Axis;
  edge?: "start" | "end";
  initial: number;
  label: string;
  max?: number;
  min?: number;
}>();

const STEP = 16;
// What the pane beside it keeps however far the handle is dragged.
const MAIN_MIN: Record<Axis, number> = { x: 360, y: 200 };
const KEYS: Record<Axis, [string, string]> = { x: ["ArrowLeft", "ArrowRight"], y: ["ArrowUp", "ArrowDown"] };
const sign = edge === "end" ? -1 : 1;

const handle = useTemplateRef<HTMLElement>("handle");
const isDragging = ref(false);
let start = 0;
let startSize = 0;

const at = (event: PointerEvent): number => (axis === "x" ? event.clientX : event.clientY);

function bound(next: number): number {
  const parent = handle.value?.parentElement;
  const room = (axis === "x" ? parent?.clientWidth : parent?.clientHeight) ?? Number.POSITIVE_INFINITY;
  return Math.round(Math.max(min, Math.min(next, max, room - MAIN_MIN[axis])));
}

function onDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  event.preventDefault();
  start = at(event);
  startSize = size.value;
  isDragging.value = true;
  handle.value?.setPointerCapture(event.pointerId);
  // A frame or an editor under the pointer would swallow the drag, so they go inert until it ends.
  document.documentElement.dataset.paneDragging = axis;
}

function onMove(event: PointerEvent): void {
  if (isDragging.value) size.value = bound(startSize + sign * (at(event) - start));
}

function onUp(): void {
  isDragging.value = false;
  delete document.documentElement.dataset.paneDragging;
}

function onKey(event: KeyboardEvent): void {
  const [less, more] = KEYS[axis];
  const next: Record<string, number> = {
    [less]: size.value - sign * STEP,
    [more]: size.value + sign * STEP,
    End: max,
    Home: min,
  };
  if (!(event.key in next)) return;
  event.preventDefault();
  size.value = bound(next[event.key] ?? size.value);
}

onScopeDispose(onUp);
</script>

<template>
  <div
    ref="handle"
    class="resizer focusable"
    role="separator"
    tabindex="0"
    :aria-orientation="axis === 'x' ? 'vertical' : 'horizontal'"
    :aria-label="label"
    :aria-valuemax="max"
    :aria-valuemin="min"
    :aria-valuenow="size"
    :data-axis="axis"
    :data-dragging="isDragging"
    data-tip="Drag to resize, double-click to reset"
    @dblclick="size = bound(initial)"
    @keydown="onKey"
    @lostpointercapture="onUp"
    @pointercancel="onUp"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
  />
</template>

<style scoped>
/* Sits in a zero-size track, so the hit area reaches into the gap on both sides. */
.resizer {
  @apply relative z-2 touch-none;
}

.resizer[data-axis="x"] {
  @apply -mx-1.5 h-full w-3 cursor-col-resize;
}

.resizer[data-axis="y"] {
  @apply -my-1.5 h-3 w-full cursor-row-resize;
}

.resizer::after {
  @apply absolute rounded-full bg-primary opacity-0 transition-opacity duration-(--duration-base) ease-out content-[''];
}

.resizer[data-axis="x"]::after {
  @apply inset-x-1.25 inset-y-3;
}

.resizer[data-axis="y"]::after {
  @apply inset-x-3 inset-y-1.25;
}

.resizer:hover::after,
.resizer:focus-visible::after,
.resizer[data-dragging="true"]::after {
  @apply opacity-100;
}

@media (prefers-reduced-motion: reduce) {
  .resizer::after {
    @apply transition-none;
  }
}
</style>

<style>
:root[data-pane-dragging] {
  @apply select-none;
}

:root[data-pane-dragging="x"] {
  @apply cursor-col-resize;
}

:root[data-pane-dragging="y"] {
  @apply cursor-row-resize;
}

:root[data-pane-dragging] iframe,
:root[data-pane-dragging] .monaco-editor,
:root[data-pane-dragging] .xterm {
  @apply pointer-events-none;
}
</style>
