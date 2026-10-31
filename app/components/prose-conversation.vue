<script lang="ts" setup>
import { Terminal } from "@lucide/vue";
import { MARK_LABEL } from "~/components/org/mark.vue";

const { conversation } = defineProps<{ conversation: string }>();

const CARD_W = 300;

const sc = useSidecar();
const terminal = $terminal();
const conversationMenu = $conversationMenu();
const tree = useOrgTree();

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

const { at, close, enter, hold, leave } = useHoverCard({
  place: (box) => ({ left: Math.max(8, Math.min(box.left - 6, window.innerWidth - CARD_W - 8)), top: box.bottom + 4 }),
  onShow: () => (conversationMenu.peeking = conversation),
  onHide: () => {
    if (conversationMenu.peeking === conversation) conversationMenu.peeking = undefined;
  },
});

const menuFor = (event: MouseEvent): void => {
  const row = place.value?.row;
  close();
  if (row) conversationMenu.openFor(event, { key: row.key, title: row.title });
};
</script>

<template>
  <span v-if="place" class="chip" @contextmenu.prevent="menuFor" @mouseenter="enter" @mouseleave="leave">
    <button class="open plain-button focusable" :aria-label="place.row.title" type="button" @click="open">
      <OrgMark :mark="place.row.mark" />
      <span v-if="place.row.role" class="role">{{ place.row.role }}</span>
      <span class="name">{{ place.row.name }}</span>
      <span v-if="isHeld" class="held" role="img" aria-label="In your terminal" data-tip="Your terminal holds this one">
        <UiIcon :icon="Terminal" size="xs" />
      </span>
    </button>
    <Teleport to="body">
      <Transition name="peek">
        <span
          v-if="at"
          class="peek"
          role="group"
          :aria-label="place.row.title"
          :style="{ left: `${at.left}px`, top: `${at.top}px` }"
          @mouseenter="hold"
          @mouseleave="leave"
        >
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
  @apply relative -top-px inline-flex h-4.5 items-center rounded-full border border-border bg-raised px-1.5 align-middle leading-none transition-colors duration-(--duration-fast) ease-out;
  max-width: min(100%, --spacing(68));
}

@media (hover: hover) and (pointer: fine) {
  .chip:hover {
    @apply border-border-strong bg-sunken;
  }
}

.open {
  @apply inline-flex min-w-0 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-fg;
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

.held {
  @apply inline-flex flex-none text-subtle;
}

.peek {
  @apply fixed z-40 flex w-75 flex-col items-start gap-2 rounded-xl border border-border bg-raised px-3.5 py-3 text-left shadow-lg;
}

.peek-head,
.peek-step {
  @apply flex w-full min-w-0 items-center gap-2;
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
  @apply w-full truncate text-muted normal-case;
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
