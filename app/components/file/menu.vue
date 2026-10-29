<script lang="ts" setup>
import { ArrowUpRight, Copy, FileText } from "@lucide/vue";

const chrome = useChrome();
const links = useLinks();
const fileMenu = $fileMenu();
const menu = useTemplateRef<{ openAt: (x: number, y: number) => void; close: () => void }>("menu");
const path = ref<string>();

const copy = async (text: string, what: string): Promise<void> => {
  await navigator.clipboard
    .writeText(text)
    .then(() => chrome.toast(`Copied the ${what}`))
    .catch(() => chrome.toast("The clipboard refused the copy", "destructive"));
};

const act = (close: () => void, run: (at: string) => unknown): void => {
  const at = path.value;
  close();
  if (at) void run(at);
};

watch(
  () => fileMenu.asked,
  (asked) => {
    if (!asked) return;
    path.value = asked.path;
    menu.value?.openAt(asked.x, asked.y);
  },
);
</script>

<template>
  <UiContextMenu ref="menu" data-region="file-menu" label="File" width="w-68">
    <template #default="{ close }">
      <div v-if="path" class="head">
        <span class="title">{{ basename(path) }}</span>
        <span class="where mono-meta">{{ homePath(path) }}</span>
      </div>
      <UiMenuItem :icon="ArrowUpRight" @click="act(close, (at) => links.open(at))">Open</UiMenuItem>
      <UiMenuItem :icon="Copy" @click="act(close, (at) => copy(at, 'path'))">Copy path</UiMenuItem>
      <UiMenuItem :icon="FileText" @click="act(close, (at) => copy(basename(at), 'filename'))"
        >Copy filename</UiMenuItem
      >
    </template>
  </UiContextMenu>
</template>

<style scoped>
.head {
  @apply flex min-w-0 flex-col gap-1 px-2 pt-2 pb-2;
}

.title {
  @apply truncate typo-caption font-bold text-fg;
}

.where {
  @apply truncate text-muted normal-case;
}
</style>
