<script lang="ts" setup>
import { MessageSquarePlus } from "@lucide/vue";
import type { ActionShape } from "~/components/chrome/action.vue";

const { shape } = defineProps<{ shape: ActionShape }>();

const chrome = useChrome();
const task = $task();

function toggle(): void {
  if (chrome.comment.armed.value) chrome.comment.disarm();
  else chrome.comment.arm();
}
</script>

<template>
  <ChromeAction
    data-region="comment-arm"
    :icon="MessageSquarePlus"
    :is-on="chrome.comment.armed.value"
    :label="shape === 'inset' ? undefined : 'Comment'"
    :shape="shape"
    :tip="
      task.isEditing
        ? 'Comment on anything · hold {C}. While you edit, {cmd K} tunes'
        : 'Comment on anything · {cmd K} or hold {C}'
    "
    @click="toggle"
  />
</template>
