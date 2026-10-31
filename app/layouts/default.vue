<script lang="ts" setup>
import { useLocalStorage, useResizeObserver } from "@vueuse/core";

const sc = useSidecar();
const chrome = useChrome();
const route = useRoute();
const artifact = $artifact();
const task = $task();
const layout = $layout();

const TREE_W = 320;
const tree = useLocalStorage("sc:tree", TREE_W);
const side = computed(() => Math.min(tree.value, layout.sideCap ?? tree.value));
const shellEl = useTemplateRef<HTMLElement>("shellEl");
const dockEl = useTemplateRef<HTMLElement>("dockEl");
const boardEl = useTemplateRef<HTMLElement>("boardEl");
const dockHeight = ref(0);
const isDown = computed(() => !!sc.failure.value);
const onShell = ref(false);
const isFullScreen = ref(false);
onMounted(() => {
  const shell = sidecarShell();
  onShell.value = !!shell;
  if (!shell) return;
  isFullScreen.value = shell.isFullScreen ?? false;
  const off = shell.onFullScreen?.((full) => (isFullScreen.value = full));
  if (off) onScopeDispose(off);
});

// A restarted server has forgotten what it followed, so the page waits on Listening for whatever is in front.
watch(isDown, (down) => {
  if (down && route.path !== "/") void navigateTo("/", { replace: true });
});
// Fetched while the server still answers, since a lazy page cannot load once it is down.
onMounted(() => void preloadRouteComponents("/"));

let queued = 0;
let sent = { dock: -1, board: -1 };

// rAF: dock and board are flex siblings, so a sync write re-notifies the other observer.
function publish(dock: number, board: number): void {
  if (dock === sent.dock && board === sent.board) return;
  sent = { dock, board };
  cancelAnimationFrame(queued);
  queued = requestAnimationFrame(() => {
    dockHeight.value = dock;
    chrome.frame.set({ dock, board });
  });
}

onScopeDispose(() => cancelAnimationFrame(queued));

useResizeObserver(shellEl, ([entry]) => {
  if (entry?.contentRect.width) layout.width = Math.round(entry.contentRect.width);
});

useResizeObserver(dockEl, ([entry]) => {
  publish(Math.round(entry?.contentRect.height ?? 0), Math.round(boardEl.value?.getBoundingClientRect().width ?? 0));
});

useResizeObserver(boardEl, ([entry]) => {
  publish(Math.round(dockEl.value?.getBoundingClientRect().height ?? 0), Math.round(entry?.contentRect.width ?? 0));
});
</script>

<template>
  <!-- Unset until measured, so the first frame takes the CSS fallback rather than
       reserving nothing and shifting the reading surface once the observer reports. -->
  <div
    ref="shellEl"
    class="shell"
    :data-full="artifact.isFull"
    :data-fullscreen="isFullScreen"
    :data-shell="onShell"
    :style="dockHeight ? { '--dock-h': `${dockHeight}px` } : undefined"
  >
    <ChromeBar :inert="isDown">
      <slot name="bar" />
      <ChromeTools />
    </ChromeBar>

    <div class="workspace" :style="{ '--side-w': `${side}px` }">
      <aside
        class="side"
        aria-label="Every workstream and conversation"
        data-region="workspace-tree"
        :data-listed="artifact.isFull && artifact.isListed"
        :inert="isDown"
      >
        <OrgTree />
        <UsagePlan />
      </aside>

      <PaneResizer v-model="tree" :initial="TREE_W" label="Resize the tree" :max="480" />

      <div class="column">
        <div class="body">
          <!-- Covered rather than unmounted, so Listening keeps its stream and opens what is in front once the server is back. -->
          <div v-show="!task.slug" class="page" :inert="isDown">
            <slot />
          </div>
          <ChannelFront v-if="task.slug" :inert="isDown" />

          <!-- One row, so the notes take whatever width the board leaves rather than
               the two hugging opposite corners and colliding in the middle. -->
          <div class="foot" data-region="dock-row">
            <div ref="boardEl" class="foot-board" data-region="board-corner">
              <slot name="board" />
            </div>

            <div ref="dockEl" class="foot-dock" data-region="dock-corner">
              <slot name="dock" />
            </div>

            <ChromeAskDoor v-if="!isDown" />
          </div>
        </div>

        <!-- Under the body rather than over it, so the notes and the door ride above it on the prompt's line. -->
        <div v-if="!task.slug" class="contents" :inert="isDown">
          <slot name="strip" />
        </div>
      </div>
    </div>

    <ListeningScreen v-if="isDown" class="down" state="reconnecting" />
  </div>
</template>

<style scoped>
.shell {
  @apply relative flex h-screen min-h-140 min-w-190 flex-col overflow-hidden bg-raised;
}

.workspace {
  @apply grid min-h-0 flex-1 grid-cols-pane;
}

.side {
  @apply flex min-h-0 flex-col overflow-hidden border-r border-r-border bg-canvas;
}

/* Over a grown sheet the tree floats at its left edge, so another task opens without leaving fullscreen. */
.side[data-listed="true"] {
  @apply fixed top-14 bottom-2 left-2 z-28 w-85 rounded-box border border-border shadow-lg;
}

/* The notes and the door float over the panes, so a pane's last row pads by --float-clear to stay clickable above them. */
.column {
  @apply relative flex min-h-0 min-w-0 flex-col bg-raised;
  --float-clear: calc(max(var(--dock-h, 0px), var(--island-row-h)) + var(--gutter));
}

.body {
  @apply relative min-h-0 flex-1;
}

.page {
  @apply absolute inset-0;
}

.foot {
  @apply pointer-events-none absolute right-(--gutter) bottom-(--gutter) left-(--gutter) z-20 flex items-end gap-2 transition-[opacity,visibility] duration-(--duration-fast) ease-out;
}

.foot-dock {
  @apply flex min-w-0 flex-1 flex-col gap-2;
}

.foot-board {
  @apply flex-none;
}

.foot-board:not(:has(*)) {
  @apply hidden;
}

.foot-board > :deep(*) {
  @apply pointer-events-auto;
}

/* A grown sheet brings its own islands, and the notes wait in the dock until it shrinks back. */
.shell[data-full="true"] .foot {
  @apply invisible opacity-0 duration-(--duration-press);
}

.down {
  @apply z-25 bg-canvas;
}

@media (prefers-reduced-motion: reduce) {
  .foot {
    @apply transition-none;
  }
}
</style>
