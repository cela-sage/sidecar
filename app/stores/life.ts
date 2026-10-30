import type { LifeChange } from "~~/shared/types/session";

export const $life = defineStore(() => {
  const sc = useSidecar();
  const chrome = useChrome();
  const resuming = ref<string[]>([]);

  const front = computed(() => isKilled(sc.sessions.value, sc.sessionKey.value ?? ""));
  const isResuming = computed(() => resuming.value.includes(sc.sessionKey.value ?? ""));

  const heard = ({ key, life }: LifeChange): void => {
    sc.sessions.value = sc.sessions.value.map((one) => (one.key === key && one.life !== life ? { ...one, life } : one));
  };

  const called = (key: string): string => {
    const session = sc.sessions.value.find((one) => one.key === key);
    return session ? nameOf(session) : key;
  };

  const change = async (key: string, verb: "kill" | "resume"): Promise<void> => {
    const url = `/api/sessions/${encodeURIComponent(key)}/${verb}`;
    const done = await $fetch<LifeChange>(url, { method: "POST" }).catch((error: unknown) => {
      chrome.toast(
        `Could not ${verb} ${called(key)}. ${failReason(error) ?? "The sidecar refused it."}`,
        "destructive",
      );
      return undefined;
    });
    if (!done) return;
    heard(done);
    chrome.toast(
      verb === "kill"
        ? `Killed ${called(key)}. Its transcript stays, and Resume brings it back.`
        : `Resumed ${called(key)}`,
      "success",
    );
  };

  const kill = (key: string): Promise<void> => change(key, "kill");

  const resume = async (key: string): Promise<void> => {
    resuming.value = [...resuming.value, key];
    await change(key, "resume");
    resuming.value = resuming.value.filter((one) => one !== key);
  };

  return { heard, isKilled: front, isResuming, kill, resume };
});
