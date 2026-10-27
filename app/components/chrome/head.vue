<script lang="ts" setup>
const { cwd, title } = defineProps<{ cwd?: string; title: string }>();

const chrome = useChrome();
</script>

<template>
  <div class="head" data-region="conversation-head">
    <UiSurface class="pill what" data-region="conversation-title" pad="none" shape="pill" variant="glass-liquid">
      <ChromeMark />
      <button
        class="switch plain-button focusable"
        data-region="conversation-switch"
        data-tip="Switch to another conversation"
        type="button"
        @click="chrome.jump.toggle()"
      >
        <span class="title">{{ title }}</span>
        <span v-if="cwd" class="cwd mono-meta">{{ homePath(cwd) }}</span>
      </button>
    </UiSurface>
  </div>
</template>

<style scoped>
/* The island row anchors this; shrinking is what keeps a long title off the cell
   to its right instead of running underneath it. */
.head {
  @apply flex min-w-0 flex-initial items-center gap-2;
}

.pill {
  @apply island-row gap-2.5 px-3.5;
}

.what {
  @apply min-w-0 flex-initial overflow-hidden;
}

.switch {
  @apply flex min-w-0 items-center gap-2.5 rounded-full border-0 bg-transparent p-0 text-left;
}

.title {
  @apply min-w-0 truncate typo-heading font-extrabold text-fg;
}

.cwd {
  @apply flex-none whitespace-nowrap text-muted normal-case;
}
</style>
