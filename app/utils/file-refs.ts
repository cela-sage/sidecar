import type { Node } from "comark";

export interface FileRef {
  start: number;
  end: number;
  path: string;
}

const EXTENSION = String.raw`\.[A-Za-z][A-Za-z0-9]{0,7}`;
const SEGMENT = String.raw`[\w.@+-]+`;
const BARE = new RegExp(String.raw`(?<![\w/:.~-])~?\/(?:${SEGMENT}\/)*${SEGMENT}${EXTENSION}(?![\w/-])`, "g");
const CODE = new RegExp(String.raw`^(?:~\/|\.{1,2}\/|\/)?(?:${SEGMENT}\/)*${SEGMENT}${EXTENSION}$`);
const KNOWN =
  /\.(?:md|mdx|html?|tsx?|jsx?|mjs|cjs|vue|json|ya?ml|toml|sh|zsh|py|txt|css|lock|ipynb|png|jpe?g|gif|svg|webp|pdf|csv|log)$/i;
const HOME = /^\/Users\/[^/]+/;
const VERBATIM = new Set(["a", "pre", "line-ref", "conversation-ref", "media-ref", "media-set", "file-ref"]);

// A name with no folder reads as a file only when its extension is one, since `config.ts` is a file and `user.name` is not.
const pathOf = (code: string): string | undefined =>
  CODE.test(code) && (code.includes("/") || KNOWN.test(code)) ? code : undefined;

const of = (text: string): FileRef[] =>
  [...text.matchAll(BARE)].map((hit) => ({ start: hit.index, end: hit.index + hit[0].length, path: hit[0] }));

// The home folder is read off the working directory the way `homePath` does, since the page is not told it.
const absolute = ({ path, cwd }: { path: string; cwd?: string }): string | undefined => {
  if (path.startsWith("/")) return path;
  if (path.startsWith("~/")) {
    const home = cwd?.match(HOME)?.[0];
    return home && `${home}${path.slice(1)}`;
  }
  return cwd && decodeURIComponent(new URL(path, `file://${cwd}/`).pathname);
};

const split = (text: string): Node[] => {
  const out: Node[] = [];
  let at = 0;
  for (const ref of of(text)) {
    if (ref.start > at) out.push(text.slice(at, ref.start));
    out.push(["file-ref", { path: ref.path }, ref.path]);
    at = ref.end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
};

const withRefs = (nodes: Node[]): Node[] =>
  nodes.flatMap((node): Node[] => {
    if (typeof node === "string") return split(node);
    const [tag, attrs, ...children] = node;
    if (tag === "code" && children.length === 1 && typeof children[0] === "string") {
      const path = pathOf(children[0]);
      return path ? [["file-ref", { path }, node]] : [node];
    }
    if (!tag || tag === "code" || VERBATIM.has(tag)) return [node];
    return [[tag, attrs, ...withRefs(children as Node[])]];
  });

export const FileRefs = { absolute, of, withRefs };
