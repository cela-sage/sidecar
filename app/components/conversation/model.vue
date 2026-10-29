<script lang="ts" setup>
import { Check, ChevronDown, ChevronRight } from "@lucide/vue";

const { current, hasHistory = false } = defineProps<{ current?: string; hasHistory?: boolean }>();

const sc = useSidecar();
const prompt = $prompt();
const terminal = $terminal();
const popover = useTemplateRef<{ close: () => void }>("popover");
const isOlder = ref(false);
const asking = ref<string>();

const name = computed(() => (current ? SessionModels.nameOf(current) : "Model"));

const close = (): void => {
  popover.value?.close();
  isOlder.value = false;
  asking.value = undefined;
};

// With history to re-read, Claude Code confirms the switch in a dialog only its terminal shows, so the pick warns first.
const pick = (id: string): void => {
  if (id === current) return close();
  if (!hasHistory) {
    close();
    void prompt.pick(id);
    return;
  }
  isOlder.value = false;
  asking.value = id;
};

const confirm = async (): Promise<void> => {
  const id = asking.value;
  const key = sc.sessionKey.value;
  close();
  if (id && key && (await prompt.pick(id))) void terminal.attach(key);
};
</script>

<template>
  <UiPopover ref="popover" :estimated-height="320" placement="top" width="w-74">
    <template #trigger="{ open }">
      <button
        class="pick plain-button focusable"
        aria-haspopup="menu"
        :aria-expanded="open"
        data-tip="Model for this session · /model"
        type="button"
        @click="asking = undefined"
      >
        {{ name }}<UiIcon class="chevron" :icon="ChevronDown" size="xs" />
      </button>
    </template>
    <div v-if="asking" class="confirm" role="alertdialog" :aria-label="`Switch to ${SessionModels.nameOf(asking)}?`">
      <span class="title">Switch to {{ SessionModels.nameOf(asking) }}?</span>
      <span class="about">
        The next reply re-reads the whole history, so it is slower and uses more tokens, and Claude Code asks you to
        confirm it in your terminal.
      </span>
      <span class="actions">
        <UiButton size="xs" variant="ghost" @click="asking = undefined">Back</UiButton>
        <UiButton
          data-tip="Sends the switch and opens this session in your terminal, where Claude Code asks"
          size="xs"
          variant="primary"
          @click="confirm"
          >Confirm in your terminal</UiButton
        >
      </span>
    </div>
    <div v-else class="menu" role="menu" aria-label="Model">
      <div class="head">
        <span class="title">Model</span>
        <span class="mono-meta">this session</span>
      </div>
      <button
        v-for="one in SessionModels.current"
        :key="one.id"
        class="item plain-button focusable"
        :aria-checked="one.id === current"
        :data-tip="one.id"
        role="menuitemradio"
        type="button"
        @click="pick(one.id)"
      >
        <span class="words">
          <span class="name">{{ one.name }}</span>
          <span class="about">{{ one.about }}</span>
        </span>
        <UiIcon v-if="one.id === current" class="check" :icon="Check" size="xs" />
      </button>
      <span class="rule" aria-hidden="true" />
      <button
        class="older plain-button focusable"
        aria-haspopup="menu"
        :aria-expanded="isOlder"
        role="menuitem"
        type="button"
        @click="isOlder = !isOlder"
      >
        <span class="older-label">Older models</span>
        <UiIcon :icon="ChevronRight" size="xs" />
      </button>
      <div v-if="isOlder" class="submenu" role="menu" aria-label="Older models">
        <div v-for="group in SessionModels.older" :key="group.family" class="group">
          <span class="family">{{ group.family }}</span>
          <button
            v-for="one in group.models"
            :key="one.id"
            class="older-item plain-button focusable"
            :aria-checked="one.id === current"
            :data-tip="one.id"
            role="menuitemradio"
            type="button"
            @click="pick(one.id)"
          >
            {{ one.name }}
            <UiIcon v-if="one.id === current" class="check" :icon="Check" size="xs" />
          </button>
        </div>
      </div>
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
  @apply relative flex flex-col gap-0.5 p-1;
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

.item:hover,
.older:hover,
.older-item:hover {
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

.rule {
  @apply mx-1.5 my-1 h-px bg-border;
}

.older {
  @apply flex h-8 items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-left typo-caption font-medium text-muted;
}

.older[aria-expanded="true"] {
  @apply bg-sunken text-fg;
}

.older-label {
  @apply flex-1;
}

.submenu {
  @apply absolute bottom-0 left-[calc(100%_+_--spacing(1.5))] flex w-52 flex-col gap-px rounded-xl border border-border bg-raised p-1 shadow-lg;
}

.group {
  @apply flex flex-col gap-px;
}

.family {
  @apply px-2 pt-2 pb-0.75 font-mono typo-mono-pico font-medium tracking-widest text-subtle uppercase;
}

.older-item {
  @apply flex h-7.5 items-center justify-between rounded-lg border-0 bg-transparent px-2 text-left typo-caption font-medium text-fg;
}
</style>
