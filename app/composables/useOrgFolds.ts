import { createSharedComposable, useLocalStorage } from "@vueuse/core";

export interface OrgFolds {
  isOpen: (key: string, fallback?: boolean) => boolean;
  toggle: (key: string, now: boolean) => void;
}

export const useOrgFolds = createSharedComposable((): OrgFolds => {
  const toggled = useLocalStorage<Partial<Record<string, boolean>>>("sc:org-folds", {});

  const isOpen = (key: string, fallback = false): boolean => toggled.value[key] ?? fallback;

  const toggle = (key: string, now: boolean): void => {
    toggled.value = { ...toggled.value, [key]: !now };
  };

  return { isOpen, toggle };
});
