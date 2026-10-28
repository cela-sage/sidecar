import type { Node } from "comark";

export interface ConversationRef {
  start: number;
  end: number;
  key: string;
}

// The @ keeps a short git hash in prose from reading as a conversation, and the long form is the door's own.
const REF = /(?<![\w@])@(?:([^@()\n]{1,120}?) \(([0-9a-f]{8})\)|([0-9a-f]{8}))(?![\w-])/g;
const VERBATIM = new Set(["a", "code", "pre", "line-ref", "conversation-ref"]);

const of = (text: string): ConversationRef[] =>
  [...text.matchAll(REF)].map((hit) => ({
    start: hit.index,
    end: hit.index + hit[0].length,
    key: hit[2] ?? hit[3] ?? "",
  }));

const split = (text: string): Node[] => {
  const out: Node[] = [];
  let at = 0;
  for (const ref of of(text)) {
    if (ref.start > at) out.push(text.slice(at, ref.start));
    out.push(["conversation-ref", { conversation: ref.key }, text.slice(ref.start, ref.end)]);
    at = ref.end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
};

const withRefs = (nodes: Node[]): Node[] =>
  nodes.flatMap((node): Node[] => {
    if (typeof node === "string") return split(node);
    const [tag, attrs, ...children] = node;
    if (!tag || VERBATIM.has(tag)) return [node];
    return [[tag, attrs, ...withRefs(children as Node[])]];
  });

export const ConversationRefs = { of, withRefs };
