<script lang="ts" setup>
import type { AgentCardInfo } from "~/utils/agent-icons";

type Side = "below" | "left" | "right";

const CARD_W = 288;
const GAP = 8;

const {
  card,
  icon,
  isKilled = false,
  isSelected = false,
  isStacked = false,
  side = "below",
  size = 20,
} = defineProps<{
  card?: AgentCardInfo;
  icon: number;
  isKilled?: boolean;
  isSelected?: boolean;
  isStacked?: boolean;
  side?: Side;
  size?: number;
}>();
const emit = defineEmits<{ open: [] }>();

const cells = computed(() => AgentIcons.cellsOf(icon));
const label = computed(() => card?.name ?? "Agent");

const PLACE: Record<Side, (box: DOMRect) => { left: number; top: number }> = {
  below: (box) => ({ left: box.left, top: box.bottom + GAP }),
  left: (box) => ({ left: box.left - GAP - CARD_W, top: box.top - GAP }),
  right: (box) => ({ left: box.right + GAP, top: box.top - GAP }),
};

const { at, close, enter, hold, leave } = useHoverCard({
  place: (box) => {
    const placed = PLACE[side](box);
    return { ...placed, left: Math.max(GAP, Math.min(placed.left, window.innerWidth - CARD_W - GAP)) };
  },
});

const open = (): void => {
  close();
  emit("open");
};
</script>

<template>
  <span
    class="agent-icon"
    role="img"
    :aria-label="label"
    :data-ink="AgentIcons.inkOf(icon)"
    :data-killed="isKilled"
    :data-selected="isSelected"
    :data-stacked="isStacked"
    :style="{ '--size': `${size}px` }"
    @mouseenter="card && enter($event)"
    @mouseleave="card && leave()"
  >
    <svg viewBox="0 0 5 5" aria-hidden="true">
      <rect v-for="{ row, col } in cells" :key="`${row}:${col}`" :x="col" :y="row" width="1.04" height="1.04" />
    </svg>
    <Teleport v-if="card" to="body">
      <Transition name="peek">
        <div
          v-if="at"
          class="peek"
          :style="{ left: `${at.left}px`, top: `${at.top}px` }"
          @mouseenter="hold"
          @mouseleave="leave"
        >
          <OrgAgentCard :card="card" :icon="icon" @open="open" />
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.agent-icon {
  @apply relative inline-flex size-(--size) flex-none items-center justify-center align-middle;
  background-color: color-mix(in oklch, var(--agent-ink) 15%, var(--raised));
  border-radius: max(--spacing(1), 26%);
}

.agent-icon svg {
  @apply size-3/5 fill-agent-ink;
  shape-rendering: crispEdges;
}

.agent-icon[data-killed="true"] {
  @apply opacity-50 grayscale;
}

.agent-icon[data-stacked="true"] {
  @apply ring-2 ring-raised;
}

.agent-icon[data-selected="true"] {
  @apply ring-2 ring-raised outline-2 outline-offset-2 outline-fg;
}

.peek {
  @apply fixed z-40;
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
