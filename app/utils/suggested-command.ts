import type { Node } from "comark";

const BANG = /^\s*!\s+(\S.*?)\s*$/;
const VERBATIM = new Set([
  "a",
  "pre",
  "code",
  "line-ref",
  "conversation-ref",
  "media-ref",
  "media-set",
  "file-ref",
  "command-ref",
]);

const of = (text: string): string | undefined => {
  const [first = ""] = text.trimStart().split("\n");
  if (!BANG.test(first)) return undefined;
  return text
    .split("\n")
    .flatMap((line) => BANG.exec(line)?.[1] ?? [])
    .join("\n");
};

const withRefs = (nodes: Node[]): Node[] =>
  nodes.map((node): Node => {
    if (typeof node === "string") return node;
    const [tag, attrs, ...children] = node;
    if (tag === "code" && children.length === 1 && typeof children[0] === "string") {
      const command = of(children[0]);
      return command ? ["command-ref", { command }, node] : node;
    }
    return !tag || VERBATIM.has(tag) ? node : [tag, attrs, ...withRefs(children as Node[])];
  });

export const SuggestedCommand = { of, withRefs };
