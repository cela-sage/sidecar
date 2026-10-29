import { useDocumentVisibility } from "@vueuse/core";
import type { Topics } from "~~/shared/types/events";

export const $seen = defineStore(() => {
  const sc = useSidecar();
  const task = $task();
  const door = $door();
  const visibility = useDocumentVisibility();
  const keys = ref<Record<string, number>>({});

  const load = async (): Promise<void> => {
    keys.value = await $fetch<Record<string, number>>("/api/sessions/unseen").catch(() => keys.value);
  };

  const heard = ({ key, endedAt }: Topics["conversation.unseen"]): void => {
    const { [key]: _, ...rest } = keys.value;
    keys.value = endedAt ? { ...rest, [key]: endedAt } : rest;
  };

  // Gone at once, because the event that confirms it comes a round trip later.
  const see = async (key: string): Promise<void> => {
    const endedAt = keys.value[key];
    if (!endedAt) return;
    heard({ key });
    await $fetch(`/api/sessions/${encodeURIComponent(key)}/seen`, { body: { endedAt }, method: "POST" }).catch(load);
  };

  const inFront = computed(() => [
    ...(task.slug ? [] : [sc.sessionKey.value]),
    ...(door.isOpen && door.mode === "assistant" ? [door.key] : []),
  ]);

  watchEffect(() => {
    if (visibility.value !== "visible") return;
    for (const key of inFront.value) if (key) void see(key);
  });

  return { heard, keys, load, see };
});
