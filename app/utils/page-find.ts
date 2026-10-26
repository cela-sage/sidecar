const SKIP = new Set(["NOSCRIPT", "SCRIPT", "STYLE", "TEMPLATE", "TEXTAREA"]);
const ALL = "sidecar-find";
const NOW = "sidecar-find-now";
const STYLE_ID = "sidecar-find-style";
// Chrome's own find colours, so a match reads the same in a page as it does in a tab.
const STYLE = `::highlight(${ALL}){background-color:#fde293;color:#1f1f1f}::highlight(${NOW}){background-color:#ff9632;color:#1f1f1f}`;

interface Stretch {
  at: number;
  node: Text;
}

const isText = (node: Node): node is Text => node.nodeType === Node.TEXT_NODE;

function stretchesOf(doc: Document): { stretches: Stretch[]; text: string } {
  const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent || SKIP.has(parent.tagName) || !parent.checkVisibility()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const stretches: Stretch[] = [];
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!isText(node)) continue;
    stretches.push({ at: text.length, node });
    text += node.data;
  }
  return { stretches, text };
}

function pointAt(stretches: Stretch[], offset: number): { node: Text; offset: number } | undefined {
  let low = 0;
  let high = stretches.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((stretches[mid]?.at ?? 0) <= offset) low = mid;
    else high = mid - 1;
  }
  const held = stretches[low];
  return held && { node: held.node, offset: offset - held.at };
}

// Matched across the whole text rather than node by node, so a word split by highlighting or inline tags is still found.
function search(doc: Document, query: string): Range[] {
  const needle = query.toLocaleLowerCase();
  if (!needle) return [];
  const { stretches, text } = stretchesOf(doc);
  const hay = text.toLocaleLowerCase();
  const ranges: Range[] = [];
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
    const start = pointAt(stretches, at);
    const end = pointAt(stretches, at + needle.length);
    if (!start || !end) continue;
    const range = doc.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    ranges.push(range);
  }
  return ranges;
}

function paint(docs: Document[], ranges: Range[], active?: Range): void {
  for (const doc of docs) {
    const win = doc.defaultView;
    if (!win?.CSS.highlights) continue;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement("style");
      style.id = STYLE_ID;
      style.textContent = STYLE;
      doc.head?.append(style);
    }
    const own = ranges.filter((range) => range.startContainer.ownerDocument === doc);
    win.CSS.highlights.set(ALL, new win.Highlight(...own));
    win.CSS.highlights.set(NOW, new win.Highlight(...(active?.startContainer.ownerDocument === doc ? [active] : [])));
  }
}

function reveal(range: Range): void {
  range.startContainer.parentElement?.scrollIntoView({ block: "center", inline: "nearest" });
}

export const PageFind = { paint, reveal, search };
