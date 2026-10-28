import type { Topics } from "~~/shared/types/events";
import type { Busy } from "~~/shared/utils/busy";

export const $busy = defineStore(() => {
  const keys = ref<Record<string, Busy>>({});

  const load = async (): Promise<void> => {
    keys.value = await $fetch<Record<string, Busy>>("/api/sessions/busy").catch(() => keys.value);
  };

  const heard = ({ key, doing, asking }: Topics["conversation.changed"]): void => {
    keys.value = { ...keys.value, [key]: { doing, asking } };
  };

  return { heard, keys, load };
});
