import type { FrameMark } from "~/types/frame";

export interface ScrollAnchorOptions {
  frame: () => HTMLIFrameElement | undefined;
  marks: () => FrameMark[];
}

export interface ScrollAnchor {
  drop: () => void;
  hold: () => void;
  restore: () => void;
}

interface Held {
  delta: number;
  index: number;
  text?: string;
  top: number;
}

function scrollerOf(el: Element | undefined): HTMLElement | undefined {
  for (let node = el?.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : undefined;
}

const offsetIn = (root: HTMLElement, el: Element): number =>
  el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;

// Held by the block at the top of the pane rather than by pixels, so a change above it lands the reader on the same words.
export function useScrollAnchor({ frame, marks }: ScrollAnchorOptions): ScrollAnchor {
  let held: Held | undefined;

  function hold(): void {
    const el = frame();
    const root = scrollerOf(el);
    if (held || !el || !root) return;
    const seen = root.scrollTop - offsetIn(root, el);
    const list = marks();
    const index = list.findIndex((mark) => mark.top + mark.height > seen);
    const mark = list[index];
    held = { delta: mark ? mark.top - seen : 0, index, text: mark?.text, top: root.scrollTop };
  }

  function restore(): void {
    const el = frame();
    const root = scrollerOf(el);
    const was = held;
    held = undefined;
    if (!was || !el || !root) return;
    const same = marks()
      .map((mark, index) => ({ index, mark }))
      .filter(({ mark }) => !!was.text && mark.text === was.text)
      .sort((a, b) => Math.abs(a.index - was.index) - Math.abs(b.index - was.index))[0];
    root.scrollTop = same ? offsetIn(root, el) + same.mark.top - was.delta : was.top;
  }

  function drop(): void {
    held = undefined;
  }

  return { drop, hold, restore };
}
