<script lang="ts" setup>
import { Terminal } from "@lucide/vue";

const { conversation } = defineProps<{ conversation: string }>();

const sc = useSidecar();
const terminal = $terminal();
const conversationMenu = $conversationMenu();
const tree = useOrgTree();

const place = computed(() => Org.placeOf(tree.value, conversation));
const isHeld = computed(() => terminal.state.held?.key === conversation);

const open = (): void => {
  if (sc.sessionKey.value === conversation) return;
  sc.sessionKey.value = conversation;
  void navigateTo(`/c/${conversation}`, { replace: true });
};

const menuFor = (event: MouseEvent): void => {
  const row = place.value?.row;
  if (row) conversationMenu.openFor(event, { key: row.key, title: row.title });
};
</script>

<template>
  <span v-if="place" class="chip" :data-tip="place.row.title" @contextmenu.prevent="menuFor">
    <OrgAvatar v-if="place.group" :project="place.group.project" :tint="place.group.tint" />
    <button class="open plain-button focusable" type="button" @click="open">
      <OrgMark :mark="place.row.mark" />
      <span class="name">{{ place.row.name }}</span>
    </button>
    <button
      class="attach plain-button focusable"
      type="button"
      :aria-label="isHeld ? 'In your terminal' : 'Attach'"
      :aria-pressed="isHeld"
      :data-tip="isHeld ? 'Your terminal holds this one' : 'Attach in your terminal'"
      :disabled="terminal.switching === conversation"
      @click.stop="!isHeld && terminal.attach(conversation)"
    >
      <UiIcon :icon="Terminal" size="xs" />
    </button>
  </span>
  <span v-else><slot /></span>
</template>

<style scoped>
.chip {
  @apply inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-sunken py-px pr-0.5 pl-1.5 align-middle;
}

.open {
  @apply inline-flex min-w-0 items-center gap-1.25 border-0 bg-transparent p-0 text-left text-fg;
}

.name {
  @apply min-w-0 truncate typo-caption font-medium;
}

.attach {
  @apply inline-flex size-5 flex-none items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-subtle transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .attach:hover {
    @apply border-border-strong text-fg;
  }
}

.attach[aria-pressed="true"] {
  @apply cursor-default border-border-strong bg-raised text-fg;
}
</style>
