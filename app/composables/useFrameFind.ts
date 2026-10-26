import type { FindTarget } from "~/stores/find";

// Electron has no find bar, so on the desktop surface the island finds in the page; in Chrome its own find already reaches the frame.
export function useFrameFind(docs: () => Document[]): void {
  const find = $find();
  const shown = useFaceShown();
  if (!(window as { sidecarShell?: unknown }).sidecarShell) return;

  let hits: Range[] = [];
  let at = 0;
  let asked = "";

  const target: FindTarget = {
    clear: () => {
      hits = [];
      PageFind.paint(docs(), []);
    },
    focus: () => docs()[0]?.defaultView?.focus(),
    search: (query, { forward, fresh }) => {
      if (fresh || query !== asked) {
        hits = docs().flatMap((doc) => PageFind.search(doc, query));
        asked = query;
        at = 0;
      } else if (hits.length) at = (at + (forward ? 1 : -1) + hits.length) % hits.length;
      const active = hits[at];
      PageFind.paint(docs(), hits, active);
      if (active) PageFind.reveal(active);
      find.result = { active: active ? at + 1 : 0, matches: hits.length };
    },
    stop: () => PageFind.paint(docs(), []),
  };

  let detach: (() => void) | undefined;
  watch(
    shown,
    (on) => {
      detach?.();
      detach = on ? find.attach(target) : undefined;
    },
    { immediate: true },
  );
  onScopeDispose(() => detach?.());
}
