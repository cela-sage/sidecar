<script lang="ts" setup>
import { Check, ChevronDown } from "@lucide/vue";
import type { SessionMode } from "~/utils/session-modes";

const { current } = defineProps<{ current?: string }>();

const sc = useSidecar();
const prompt = $prompt();
const terminal = $terminal();
const popover = useTemplateRef<{ close: () => void }>("popover");
const asking = ref<string>();

const name = computed(() => (current ? SessionModes.nameOf(current) : "Mode"));

const close = (): void => {
  popover.value?.close();
  asking.value = undefined;
};

const pick = ({ id, command }: SessionMode): void => {
  if (id === current) return close();
  if (!command) {
    asking.value = id;
    return;
  }
  close();
  void prompt.switchMode({ id, command });
};

const attach = (): void => {
  const key = sc.sessionKey.value;
  close();
  if (key) void terminal.attach(key);
};
</script>

<template>
  <UiPopover ref="popover" :estimated-height="260" placement="top" width="w-74">
    <template #trigger="{ open }">
      <button
        class="pick plain-button focusable"
        aria-haspopup="menu"
        :aria-expanded="open"
        data-tip="Permission mode for this session"
        type="button"
        @click="asking = undefined"
      >
        {{ name }}<UiIcon class="chevron" :icon="ChevronDown" size="xs" />
      </button>
    </template>
    <div
      v-if="asking"
      class="confirm"
      role="alertdialog"
      :aria-label="`Change to ${SessionModes.nameOf(asking)} in your terminal`"
    >
      <span class="title">Change to {{ SessionModes.nameOf(asking) }} in your terminal</span>
      <span class="about">
        Claude Code gives the sidecar no way to change the mode of a running conversation, so attach it and press ⇧⇥
        until it shows {{ SessionModes.nameOf(asking).toLowerCase() }}.
      </span>
      <span v-if="asking === 'bypassPermissions'" class="about">
        Bypass permissions skips every check, and Claude Code offers it only to a session started with it.
      </span>
      <span class="actions">
        <UiButton size="xs" variant="ghost" @click="asking = undefined">Back</UiButton>
        <UiButton data-tip="Opens this conversation in your terminal" size="xs" variant="primary" @click="attach"
          >Attach</UiButton
        >
      </span>
    </div>
    <div v-else class="menu" role="menu" aria-label="Permission mode">
      <div class="head">
        <span class="title">Permission mode</span>
        <span class="mono-meta">this session</span>
      </div>
      <button
        v-for="one in SessionModes.listed"
        :key="one.id"
        class="item plain-button focusable"
        :aria-checked="one.id === current"
        :data-tip="one.command ? `Runs /${one.command} in the session` : undefined"
        role="menuitemradio"
        type="button"
        @click="pick(one)"
      >
        <span class="words">
          <span class="name">{{ one.name }}</span>
          <span class="about">{{ one.about }}</span>
        </span>
        <UiIcon v-if="one.id === current" class="check" :icon="Check" size="xs" />
      </button>
    </div>
  </UiPopover>
</template>

<style scoped>
.pick {
  @apply inline-flex h-7 items-center gap-1.25 rounded-full border border-transparent bg-transparent pr-2 pl-2.5 typo-caption font-semibold text-fg transition-colors duration-(--duration-fast) ease-out;
}

.pick[aria-expanded="true"] {
  @apply border-border-strong bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .pick:hover {
    @apply bg-sunken;
  }
}

.chevron {
  @apply text-muted;
}

.menu {
  @apply flex flex-col gap-0.5 p-1;
}

.confirm {
  @apply flex flex-col gap-2 p-3.5;
}

.actions {
  @apply mt-1 flex justify-end gap-1.5;
}

.head {
  @apply flex items-center gap-2 px-2 pt-2 pb-1;
}

.title {
  @apply typo-caption font-bold;
}

.item {
  @apply flex items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.75 text-left transition-colors duration-(--duration-fast) ease-out;
}

.item[aria-checked="true"] {
  @apply bg-sunken;
}

.item:hover {
  @apply bg-primary-soft;
}

.words {
  @apply flex min-w-0 flex-1 flex-col gap-0.5;
}

.name {
  @apply typo-caption font-semibold text-fg;
}

.about {
  @apply typo-caption text-muted;
}

.check {
  @apply flex-none text-fg;
}
</style>
