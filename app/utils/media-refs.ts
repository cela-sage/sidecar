import type { Node } from "comark";

const MEDIA = /^[^\s`]+\.(?:svg|png|jpe?g|gif|webp|avif|mp4|webm|mov|m4v|m4a|mp3|wav|ogg|aac|flac)$/i;
const BLOCKS = new Set(["p", "ul", "ol", "pre", "blockquote", "table", "h1", "h2", "h3", "h4", "h5", "h6"]);
const SKIPPED = new Set(["a", "pre", "conversation-ref"]);

const tagOf = (node: Node): string => (typeof node === "string" ? "" : (node[0] ?? ""));

const pathOf = (node: Node): string | undefined => {
  if (typeof node === "string") return undefined;
  const [tag, , only, ...rest] = node;
  return tag === "code" && !rest.length && typeof only === "string" && MEDIA.test(only) ? only : undefined;
};

const marked = (children: Node[], found: string[]): Node[] =>
  children.map((child): Node => {
    const path = pathOf(child);
    if (path) {
      if (!found.includes(path)) found.push(path);
      return ["media-ref", { path }, path];
    }
    if (typeof child === "string" || SKIPPED.has(tagOf(child))) return child;
    const [tag, attrs, ...inner] = child;
    return tag ? [tag, attrs, ...marked(inner as Node[], found)] : child;
  });

const setOf = (found: string[]): Node[] => (found.length ? [["media-set", { paths: found.join("\n") }]] : []);

const withMedia = (nodes: Node[]): Node[] =>
  nodes.flatMap((node): Node[] => {
    if (typeof node === "string") return [node];
    const [tag, attrs, ...children] = node;
    const found: string[] = [];
    if (!tag) return [node];
    if (tag === "p") return [[tag, attrs, ...marked(children as Node[], found)], ...setOf(found)];
    if (tag === "li") {
      const inner = (children as Node[]).flatMap((child) =>
        BLOCKS.has(tagOf(child)) ? withMedia([child]) : marked([child], found),
      );
      return [[tag, attrs, ...inner, ...setOf(found)]];
    }
    if (tag === "pre" || tag === "code") return [node];
    return [[tag, attrs, ...withMedia(children as Node[])]];
  });

export const MediaRefs = { withMedia };
