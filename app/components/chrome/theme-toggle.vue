<script lang="ts" setup>
import { Moon, Sun } from "@lucide/vue";
import type { ActionShape } from "~/components/chrome/action.vue";

const { shape = "island", size } = defineProps<{ shape?: ActionShape; size?: "sm" | "md" }>();

const look = useTheme();
const isDark = computed(() => look.theme.value === "dark");
</script>

<template>
  <ChromeAction
    data-region="theme-toggle"
    :icon="isDark ? Sun : Moon"
    :shape="shape"
    :size="size"
    :tip="isDark ? 'Light theme' : 'Dark theme'"
    @click="look.toggle"
  />
</template>
