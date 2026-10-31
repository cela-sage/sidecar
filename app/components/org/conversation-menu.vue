<script lang="ts" setup>
import { ArrowUpRight, AtSign, Copy, ListTree, Pencil, Play, Power, Trash2 } from "@lucide/vue";
import type { ConversationTarget } from "~/stores/conversation-menu";

const sc = useSidecar();
const chrome = useChrome();
const desk = $desk();
const prompt = $prompt();
const life = $life();
const conversationMenu = $conversationMenu();
const menu = useTemplateRef<{ openAt: (x: number, y: number) => void; close: () => void }>("menu");
const target = ref<ConversationTarget>();
const isRenaming = ref(false);
const isKilledTarget = computed(() => !!target.value && isKilled(sc.sessions.value, target.value.key));

const nameOf = (one: ConversationTarget): string => one.title || one.key;

const open = (one: ConversationTarget): void => {
  if (one.open) return one.open();
  sc.sessionKey.value = one.key;
  void navigateTo(`/c/${one.key}`, { replace: true });
};

const copyId = async ({ key }: ConversationTarget): Promise<void> => {
  await navigator.clipboard
    .writeText(key)
    .then(() => chrome.toast(`Copied ${key}`))
    .catch(() => chrome.toast("The clipboard refused the copy", "destructive"));
};

const act = (close: () => void, run: (one: ConversationTarget) => unknown): void => {
  const one = target.value;
  close();
  if (one) void run(one);
};

const rename = (title: string): void => {
  const one = target.value;
  menu.value?.close();
  if (one && title !== one.title) void desk.renameConversation({ key: one.key, title, name: nameOf(one) });
};

watch(
  () => conversationMenu.asked,
  (asked) => {
    if (!asked) return;
    target.value = asked.target;
    isRenaming.value = false;
    menu.value?.openAt(asked.x, asked.y);
  },
);
</script>

<template>
  <UiContextMenu ref="menu" data-region="org-conversation-menu" label="Conversation" width="w-68">
    <template #default="{ close }">
      <OrgDraft
        v-if="isRenaming && target"
        action="Rename"
        :initial="target.title"
        label="Rename the conversation"
        placeholder="The conversation's new title"
        tip="Rename, keeping its key · {enter}"
        @cancel="close()"
        @name="rename"
      />
      <template v-else>
        <div v-if="target" class="head">
          <span class="title">{{ nameOf(target) }}</span>
          <span class="key mono-meta">{{ target.key }}</span>
        </div>
        <UiMenuItem :icon="ArrowUpRight" @click="act(close, open)">Open</UiMenuItem>
        <UiMenuItem :icon="AtSign" @click="act(close, (one) => prompt.mention({ key: one.key, title: nameOf(one) }))"
          >Mention in the prompt</UiMenuItem
        >
        <UiMenuItem :icon="ListTree" @click="act(close, (one) => conversationMenu.reveal(one.key))"
          >Reveal in the tree</UiMenuItem
        >
        <UiMenuItem :icon="Copy" @click="act(close, copyId)">Copy id</UiMenuItem>
        <span class="rule" aria-hidden="true" />
        <UiMenuItem :icon="Pencil" @click="isRenaming = true">Rename</UiMenuItem>
        <UiMenuItem v-if="isKilledTarget" :icon="Play" @click="act(close, (one) => life.resume(one.key))"
          >Resume</UiMenuItem
        >
        <UiMenuItem v-else :icon="Power" @click="act(close, (one) => life.kill(one.key))">Kill</UiMenuItem>
        <UiMenuItem
          :icon="Trash2"
          tone="destructive"
          @click="act(close, (one) => desk.removeConversation({ key: one.key, name: nameOf(one) }))"
          >Remove</UiMenuItem
        >
      </template>
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

.key {
  @apply text-muted normal-case;
}

.rule {
  @apply mx-1.5 my-1 h-px bg-border;
}
</style>
