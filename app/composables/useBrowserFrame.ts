export interface BrowserFrameOptions {
  base: () => string | undefined;
  docs: () => Document[];
}

export interface BrowserFrame {
  attach: () => void;
  detach: () => void;
}

// The frame is a second realm, so `instanceof Element` from out here is always false; duck-typing is the only test.
const anchorOf = (target: unknown): string | undefined =>
  (target as Element | undefined)?.closest?.("a[href]")?.getAttribute("href") ?? undefined;

export function useBrowserFrame({ base, docs }: BrowserFrameOptions): BrowserFrame {
  const links = useLinks();
  const artifact = $artifact();
  const key = inject(BROWSER_KEY, undefined);
  let unbind: (() => void)[] = [];

  function bind(doc: Document): void {
    // Followed in place, a link would navigate the file out of its own frame.
    const onClick = (event: MouseEvent): void => {
      const href = anchorOf(event.target);
      if (!href || !links.owns(href)) return;
      event.preventDefault();
      void links.open(href, { base: base() });
    };
    const onOver = (event: MouseEvent): void => {
      const href = anchorOf(event.target);
      artifact.link = href ? links.describe(href, { base: base() }) : undefined;
    };
    const onOut = (event: MouseEvent): void => {
      if (!event.relatedTarget) artifact.link = undefined;
    };
    const onKey = (event: KeyboardEvent): void => {
      if (key?.(event)) event.preventDefault();
    };
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("mouseover", onOver);
    doc.addEventListener("mouseout", onOut);
    doc.addEventListener("keydown", onKey);
    unbind.push(() => {
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("mouseover", onOver);
      doc.removeEventListener("mouseout", onOut);
      doc.removeEventListener("keydown", onKey);
    });
  }

  function detach(): void {
    for (const off of unbind) off();
    unbind = [];
    artifact.link = undefined;
  }

  function attach(): void {
    detach();
    for (const doc of docs()) bind(doc);
  }

  onScopeDispose(detach);
  return { attach, detach };
}
