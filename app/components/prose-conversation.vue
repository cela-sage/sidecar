<script lang="ts" setup>
import { Terminal } from "@lucide/vue";
import { MARK_LABEL } from "~/components/org/mark.vue";

const { conversation } = defineProps<{ conversation: string }>();

const DWELL_MS = 350;
const CARD_W = 300;

const sc = useSidecar();
const terminal = $terminal();
const conversationMenu = $conversationMenu();
const tree = useOrgTree();
const chip = useTemplateRef<HTMLElement>("chip");
const at = ref<{ left: number; top: number }>();
let dwell: ReturnType<typeof setTimeout> | undefined;

const place = computed(() => Org.placeOf(tree.value, conversation));
const session = computed(() => sc.sessions.value.find((one) => one.key === conversation));
const isHeld = computed(() => terminal.holds(conversation));
const task = computed(() => {
  const slug = place.value?.row.slug;
  return slug ? Tasks.of(sc.catalogue.value).find((one) => one.slug === slug) : undefined;
});
const step = computed(() => {
  const mark = place.value?.row.mark;
  return session.value?.detail || (mark ? MARK_LABEL[mark] : "");
});
const meta = computed(() =>
  [conversation, place.value?.group?.project.name, task.value && (task.value.title || deslug(task.value.slug))]
    .filter(Boolean)
    .join(" · "),
);

const open = (): void => {
  if (sc.sessionKey.value === conversation) return;
  sc.sessionKey.value = conversation;
  void navigateTo(`/c/${conversation}`, { replace: true });
};

const peek = (): void => {
  const box = chip.value?.getBoundingClientRect();
  if (!box) return;
  at.value = { left: Math.max(8, Math.min(box.left - 6, window.innerWidth - CARD_W - 8)), top: box.bottom + 8 };
  conversationMenu.peeking = conversation;
};

const enter = (): void => {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  dwell = setTimeout(peek, DWELL_MS);
};

const leave = (): void => {
  clearTimeout(dwell);
  at.value = undefined;
  if (conversationMenu.peeking === conversation) conversationMenu.peeking = undefined;
};

const menuFor = (event: MouseEvent): void => {
  const row = place.value?.row;
  leave();
  if (row) conversationMenu.openFor(event, { key: row.key, title: row.title });
};

onScopeDispose(leave);
</script>

<template>
  <span
    v-if="place"
    ref="chip"
    class="chip"
    @contextmenu.prevent="menuFor"
    @mouseenter="enter"
    @mouseleave="leave"
  >
    <OrgAvatar v-if="place.group" :project="place.group.project" :tint="place.group.tint" />
    <button class="open plain-button focusable" :aria-label="place.row.title" type="button" @click="open">
      <OrgMark :mark="place.row.mark" />
      <span v-if="place.row.role" class="role">{{ place.row.role }}</span>
      <span class="name">{{ place.row.name }}</span>
    </button>
    <button
      class="attach plain-button focusable"
      type="button"
      :aria-label="isHeld ? 'In your terminal' : 'Attach in your terminal'"
      :aria-pressed="isHeld"
      :data-tip="isHeld ? 'Your terminal holds this one' : 'Attach in your terminal'"
      :disabled="terminal.switching === conversation"
      @click.stop="!isHeld && terminal.attach(conversation)"
    >
      <UiIcon :icon="Terminal" size="xs" />
    </button>
    <Teleport to="body">
      <Transition name="peek">
        <span v-if="at" class="peek" role="tooltip" :style="{ left: `${at.left}px`, top: `${at.top}px` }">
          <span class="peek-head">
            <OrgAvatar v-if="place.group" :project="place.group.project" :tint="place.group.tint" />
            <span class="peek-title">{{ place.row.title }}</span>
          </span>
          <span class="peek-step">
            <OrgMark :mark="place.row.mark" />
            <span class="peek-line" :data-working="place.row.mark === 'working'">{{ step }}</span>
          </span>
          <span class="peek-meta mono-meta">{{ meta }}</span>
        </span>
      </Transition>
    </Teleport>
  </span>
  <span v-else><slot /></span>
</template>

<style scoped>
.chip {
  @apply relative -top-px inline-flex h-5.5 items-center gap-0.75 rounded-full border border-border bg-raised py-0 pr-0.75 pl-1.5 align-middle leading-none transition-colors duration-(--duration-fast) ease-out;
  max-width: min(100%, --spacing(68));
}

@media (hover: hover) and (pointer: fine) {
  .chip:hover {
    @apply border-border-strong bg-sunken;
  }
}

.open {
  @apply inline-flex min-w-0 items-center gap-1.75 border-0 bg-transparent py-0 pr-1 pl-1 text-left text-fg;
}

.role {
  @apply flex-none rounded-sm bg-sunken px-1.25 py-px typo-mono-pico font-semibold tracking-wide text-muted;
}

.chip:hover .role {
  @apply bg-raised;
}

.name {
  @apply max-w-40 min-w-0 truncate typo-caption font-semibold;
}

.attach {
  @apply inline-flex size-4.5 flex-none items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-subtle transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .attach:hover {
    @apply border-border-strong text-fg;
  }
}

.attach[aria-pressed="true"] {
  @apply cursor-default border-fg bg-fg text-canvas;
}

.peek {
  @apply pointer-events-none fixed z-40 flex w-75 flex-col gap-2 rounded-xl border border-border bg-raised px-3.5 py-3 text-left shadow-lg;
}

.peek-head,
.peek-step {
  @apply flex min-w-0 items-center gap-2;
}

.peek-title {
  @apply min-w-0 flex-1 truncate typo-caption font-bold text-fg;
}

.peek-line {
  @apply min-w-0 flex-1 typo-caption leading-snug font-medium text-fg;
}

.peek-line[data-working="true"] {
  @apply shimmer;
}

.peek-meta {
  @apply truncate text-muted normal-case;
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
