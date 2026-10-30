<script lang="ts" setup>
import { ListTree } from "@lucide/vue";
import type { ActionShape } from "~/components/chrome/action.vue";

const { shape = "island", size } = defineProps<{ shape?: ActionShape; size?: "sm" | "md" }>();

const chat = useChatDetail();
const isDetailed = computed(() => chat.detail.value === "detailed");
</script>

<template>
  <ChromeAction
    data-region="detail-toggle"
    :icon="ListTree"
    :is-on="isDetailed"
    :shape="shape"
    :size="size"
    :tip="isDetailed ? 'Detailed chat · switch to Simple' : 'Simple chat · switch to Detailed'"
    @click="chat.toggle"
  />
</template>
