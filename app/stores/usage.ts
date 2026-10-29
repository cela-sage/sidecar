import type { Topics } from "~~/shared/types/events";
import type { RateLimit, SessionUsage } from "~~/shared/types/usage";

export const $usage = defineStore(() => {
  const sc = useSidecar();
  const prompt = $prompt();
  const limits = ref<RateLimit[]>([]);
  const held = ref<Partial<Record<string, SessionUsage>>>({});
  const reading = ref<string>();

  const front = computed(() => held.value[sc.sessionKey.value ?? ""]);
  const isCompacting = computed(() => !!front.value?.isCompacting);

  const loadPlan = async (): Promise<void> => {
    const reply = await $fetch<{ rateLimits: RateLimit[] }>("/api/usage").catch(() => undefined);
    if (reply) limits.value = reply.rateLimits;
  };

  const load = async (key: string): Promise<void> => {
    const query = reading.value === key ? { breakdown: 1 } : undefined;
    const reply = await $fetch<{ usage?: SessionUsage }>(`/api/sessions/${encodeURIComponent(key)}/usage`, {
      query,
    }).catch(() => undefined);
    if (reply) held.value = { ...held.value, [key]: reply.usage };
  };

  const heard = ({ key }: Topics["usage.changed"]): void => {
    void loadPlan();
    if (key === sc.sessionKey.value || held.value[key]) void load(key);
  };

  const reload = async (): Promise<void> => {
    await loadPlan();
    if (sc.sessionKey.value) await load(sc.sessionKey.value);
  };

  const read = (key: string): void => {
    reading.value = key;
    void load(key);
  };

  const release = (key: string): void => {
    if (reading.value === key) reading.value = undefined;
  };

  const compact = (key: string, focus: string): Promise<unknown> =>
    prompt.run(key, { name: "compact", args: focus.trim() });

  watch(
    () => sc.sessionKey.value,
    (key) => {
      if (key) void load(key);
    },
    { immediate: true },
  );

  return { compact, front, heard, isCompacting, limits, loadPlan, read, release, reload };
});
