import type { TerminalState } from "~~/shared/types/events";

export type Attached = "docked" | "sent" | "copied";

export const $terminal = defineStore(() => {
  const SWITCH_MS = 8000;
  const chrome = useChrome();
  const dock = $dock();
  const state = ref<TerminalState>({ following: false });
  const switching = ref<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const load = async (): Promise<void> => {
    state.value = await $fetch<TerminalState>("/api/attach").catch(() => state.value);
  };

  const heard = (next: TerminalState): void => {
    state.value = next;
    if (!next.following || next.held?.key === switching.value) {
      clearTimeout(timer);
      switching.value = undefined;
    }
  };

  const copy = async (key: string): Promise<Attached> => {
    const line = `claude attach ${key}`;
    await navigator.clipboard
      .writeText(line)
      .then(() => chrome.toast(`Copied ${line}. sidecar terminal isn't following, so paste it yourself`))
      .catch(() => chrome.toast("The clipboard refused the copy", "destructive"));
    return "copied";
  };

  // One holder per session, because a session draws at one size: the dock while it is open, the follower otherwise.
  const holds = (key: string): boolean => (dock.isOpen ? dock.holds(key) : state.value.held?.key === key);

  const attach = async (key: string): Promise<Attached> => {
    if (dock.isOpen) {
      await dock.attach(key);
      return "docked";
    }
    if (!state.value.following) return copy(key);
    switching.value = key;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (switching.value !== key) return;
      switching.value = undefined;
      chrome.toast("sidecar terminal didn't attach it. Check the terminal it runs in", "destructive");
    }, SWITCH_MS);
    const sent = await $fetch("/api/attach", { method: "POST", body: { key } }).then(
      () => true,
      () => false,
    );
    if (sent) return "sent";
    switching.value = undefined;
    await load();
    return copy(key);
  };

  return { attach, heard, holds, load, state, switching };
});
