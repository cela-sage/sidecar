export interface FindResult {
  active: number;
  matches: number;
}

export interface FindSearch {
  forward: boolean;
  fresh: boolean;
}

export interface FindTarget {
  clear(): void;
  focus(): void;
  search(query: string, how: FindSearch): void;
  stop(): void;
}

// Only a page that can search itself attaches, so with none ⌘F stays the browser's own.
export const $find = defineStore(() => {
  const isOpen = ref(false);
  const query = ref("");
  const result = ref<FindResult>();
  const focusing = ref(0);
  let target: FindTarget | undefined;

  function search(how: FindSearch): void {
    if (!target || !isOpen.value) return;
    if (!query.value) {
      target.clear();
      result.value = undefined;
      return;
    }
    target.search(query.value, how);
  }

  function attach(next: FindTarget): () => void {
    target = next;
    return () => {
      if (target !== next) return;
      close();
      target = undefined;
    };
  }

  function open(): boolean {
    if (!target) return false;
    isOpen.value = true;
    focusing.value += 1;
    search({ forward: true, fresh: true });
    return true;
  }

  function close(): void {
    if (!isOpen.value) return;
    isOpen.value = false;
    result.value = undefined;
    target?.stop();
  }

  function leave(): void {
    close();
    target?.focus();
  }

  function step(by: -1 | 1): boolean {
    if (!target) return false;
    if (!isOpen.value) return open();
    search({ forward: by > 0, fresh: false });
    return true;
  }

  function rerun(): void {
    result.value = undefined;
    search({ forward: true, fresh: true });
  }

  watch(query, () => search({ forward: true, fresh: true }));

  return { attach, close, focusing, isOpen, leave, open, query, rerun, result, step };
});
