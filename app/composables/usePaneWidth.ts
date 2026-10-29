import { createSharedComposable, useLocalStorage } from "@vueuse/core";
import type { RemovableRef } from "@vueuse/core";

export interface PaneWidth {
  initial: number;
  width: RemovableRef<number>;
}

// One width for the tool window of every face, so resizing it in Files carries over to Review, History and Artifacts.
export const usePaneWidth = createSharedComposable((): PaneWidth => {
  const initial = 280;
  return { initial, width: useLocalStorage("sc:pane", initial) };
});
