import type { Ref } from "vue";

export interface HoverCardAt {
  left: number;
  top: number;
}

export interface HoverCardOptions {
  place: (box: DOMRect) => HoverCardAt;
  onShow?: () => void;
  onHide?: () => void;
}

export interface HoverCard {
  at: Ref<HoverCardAt | undefined>;
  close: () => void;
  enter: (event: MouseEvent) => void;
  hold: () => void;
  leave: () => void;
}

const DWELL_MS = 350;
const GRACE_MS = 120;

export const useHoverCard = ({ place, onShow, onHide }: HoverCardOptions): HoverCard => {
  const at = ref<HoverCardAt>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const peek = (anchor: HTMLElement): void => {
    at.value = place(anchor.getBoundingClientRect());
    onShow?.();
  };

  const close = (): void => {
    clearTimeout(timer);
    at.value = undefined;
    onHide?.();
  };

  const enter = ({ currentTarget }: MouseEvent): void => {
    clearTimeout(timer);
    if (at.value || !(currentTarget instanceof HTMLElement)) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    timer = setTimeout(() => peek(currentTarget), DWELL_MS);
  };

  const hold = (): void => clearTimeout(timer);

  // The pointer gets a beat to cross from the anchor onto the card, so it does not close in the gap.
  const leave = (): void => {
    clearTimeout(timer);
    timer = setTimeout(close, GRACE_MS);
  };

  onScopeDispose(close);

  return { at, close, enter, hold, leave };
};
