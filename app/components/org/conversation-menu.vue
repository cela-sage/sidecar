<script lang="ts" setup>
import { ArrowUpRight, Pencil, Terminal, Trash2 } from "@lucide/vue";
import type { ConversationTarget } from "~/stores/conversation-menu";

const sc = useSidecar();
const desk = $desk();
const terminal = $terminal();
const conversationMenu = $conversationMenu();
const menu = useTemplateRef<{ openAt: (x: number, y: number) => void; close: () => void }>("menu");
const target = ref<ConversationTarget>();
const isRenaming = ref(false);

const nameOf = (one: ConversationTarget): string => one.title || one.key;

const open = (one: ConversationTarget): void => {
  if (one.open) return one.open();
  sc.sessionKey.value = one.key;
  void navigateTo(`/c/${one.key}`, { replace: true });
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
  <UiContextMenu ref="menu" data-region="org-conversation-menu" label="Conversation" width="w-72">
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
        <UiMenuItem :icon="ArrowUpRight" @click="act(close, open)">Open</UiMenuItem>
        <UiMenuItem
          :disabled="!target || terminal.switching === target.key"
          :icon="Terminal"
          @click="act(close, (one) => terminal.attach(one.key))"
          >Attach</UiMenuItem
        >
        <UiMenuItem :icon="Pencil" @click="isRenaming = true">Rename</UiMenuItem>
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
