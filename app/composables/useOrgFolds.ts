import { createSharedComposable, useLocalStorage } from "@vueuse/core";

export type OrgLine<T> = { key: string; depth: number; item: T } | { key: string; depth: number; fold: number };

export interface OrgLines<T> {
  open: T[];
  done: T[];
  fold: string;
  depth: number;
  keyOf: (one: T) => string;
}

export interface OrgFolds {
  isOpen: (key: string, fallback?: boolean) => boolean;
  toggle: (key: string, now: boolean) => void;
  linesOf: <T>(lines: OrgLines<T>) => OrgLine<T>[];
}

export const useOrgFolds = createSharedComposable((): OrgFolds => {
  const toggled = useLocalStorage<Partial<Record<string, boolean>>>("sc:org-folds", {});

  const isOpen = (key: string, fallback = false): boolean => toggled.value[key] ?? fallback;

  const toggle = (key: string, now: boolean): void => {
    toggled.value = { ...toggled.value, [key]: !now };
  };

  const linesOf = <T>({ open, done, fold, depth, keyOf }: OrgLines<T>): OrgLine<T>[] => [
    ...open.map((item) => ({ key: keyOf(item), depth, item })),
    ...(done.length ? [{ key: fold, depth, fold: done.length }] : []),
    ...(isOpen(fold) ? done.map((item) => ({ key: keyOf(item), depth, item })) : []),
  ];

  return { isOpen, toggle, linesOf };
});
