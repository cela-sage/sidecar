import { createSharedComposable, useLocalStorage } from "@vueuse/core";
import type { Ref } from "vue";

export type ChatDetail = "detailed" | "simple";

export interface ChatDetailSwitch {
  detail: Ref<ChatDetail>;
  toggle: () => void;
}

export const useChatDetail = createSharedComposable((): ChatDetailSwitch => {
  const detail = useLocalStorage<ChatDetail>("cela-chat-detail", "simple");
  return {
    detail,
    toggle: () => {
      detail.value = detail.value === "detailed" ? "simple" : "detailed";
    },
  };
});
