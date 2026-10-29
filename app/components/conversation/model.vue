<script lang="ts" setup>
import { Check, ChevronDown, ChevronRight } from "@lucide/vue";

const { current } = defineProps<{ current?: string }>();

const prompt = $prompt();
const popover = useTemplateRef<{ close: () => void }>("popover");
const isOlder = ref(false);

const name = computed(() => (current ? SessionModels.nameOf(current) : "Model"));

const pick = (id: string): void => {
  popover.value?.close();
  isOlder.value = false;
  if (id !== current) void prompt.pick(id);
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
      >
        {{ name }}<UiIcon class="chevron" :icon="ChevronDown" size="xs" />
      </button>
    </template>
    <div class="menu" role="menu" aria-label="Model">
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
