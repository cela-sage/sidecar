import { useEventListener } from "@vueuse/core";
import type { InjectionKey, Ref } from "vue";
import { isTyping } from "~~/lib/web/page/blocks";
import { findOf, isAddressKey, stepOf } from "~~/lib/web/page/keys";
import type { FindKey } from "~~/lib/web/page/protocol";

export type BrowserKey = (event: KeyboardEvent) => boolean;

export const BROWSER_KEY: InjectionKey<BrowserKey> = Symbol("browser-key");

const owners = shallowReactive(new Set<Ref<boolean>>());

// An artifact in front owns ⌘R, so the run keys that share it step aside.
export const areBrowserKeysLive = (): boolean => [...owners].some((shown) => shown.value);

// With the sidecar focused, ⌘R, ⌘[, ⌘L and ⌘F would act on the sidecar itself rather than the artifact in it.
export function useBrowserKeys(): BrowserKey {
  const sc = useSidecar();
  const web = $web();
  const find = $find();
  const shown = useFaceShown();
  owners.add(shown);
  onScopeDispose(() => owners.delete(shown));

  const SEEK: Record<FindKey, () => boolean> = {
    find: () => find.open(),
    "find-next": () => find.step(1),
    "find-previous": () => find.step(-1),
  };

  const handle: BrowserKey = (event) => {
    if (!(event.metaKey || event.ctrlKey)) return false;
    const seek = findOf(event);
    if (seek) return SEEK[seek]();
    if (isAddressKey(event)) {
      web.askAddress();
      return true;
    }
    if (event.key.toLowerCase() === "r" && !event.shiftKey && !event.altKey) {
      web.reload();
      return true;
    }
    const by = isTyping(event.target) ? undefined : stepOf(event);
    if (!by || sc.artifact.value?.kind !== "web") return false;
    web.step(by);
    return true;
  };

  useEventListener(window, "keydown", (event: KeyboardEvent) => {
    if (shown.value && handle(event)) event.preventDefault();
  });
  provide(BROWSER_KEY, handle);
  return handle;
}
