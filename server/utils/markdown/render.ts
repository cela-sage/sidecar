import { renderMermaidSVGAsync } from "beautiful-mermaid";
import { createMarkdownParser } from "comark";
import type { ArtifactTask } from "../../../shared/types/task.ts";
import { Syntax } from "../../../shared/utils/highlight.ts";
import { Uploads } from "../uploads.ts";
import { isElement, soleChild, type MdNode } from "./node.ts";
import { Proposals, type Proposal } from "./proposals.ts";
import { TaskPage } from "./task.ts";

interface Context {
  css: Set<string>;
  held: Map<string, Proposal>;
}

// A local file the user or Claude wrote, so the html plugin stays on and raw tags render as written.
const parse = createMarkdownParser({ autoClose: false });

const VOID = new Set(["area", "br", "col", "embed", "hr", "img", "input", "source", "track", "wbr"]);
// The svg sets its own --bg, so the page's arrives through a bridge; --muted, --accent, --surface and --border inherit by name.
const DIAGRAM = { bg: "var(--page-bg)", fg: "var(--ink)", transparent: true };
const SVG_STYLE = /<style>([\s\S]*?)<\/style>/g;
const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const attrsOf = (props: Record<string, unknown>): string => {
  let out = "";
  for (const [key, value] of Object.entries(props)) {
    const bound = key.startsWith(":");
    const name = bound ? key.slice(1) : key;
    // `$` is the parser's bookkeeping, and a bound `:disabled="true"` is how a task box arrives.
    if (key === "$" || value === false || (bound && value === "false")) continue;
    if (value === true || (bound && value === "true")) out += ` ${name}`;
    else if (typeof value === "string" || typeof value === "number") out += ` ${name}="${escapeHtml(String(value))}"`;
    else if (Array.isArray(value)) out += ` ${name}="${escapeHtml(value.join(" "))}"`;
  }
  return out;
};

// A fence's own child holds its raw text once, so highlighting it here beats reaching back in from `code`.
const fenceOf = (
  node: MdNode,
): { pre: Record<string, unknown>; code: Record<string, unknown>; lang: string; text: string } | undefined => {
  if (typeof node === "string") return undefined;
  const [tag, pre, child] = node;
  if (tag !== "pre" || typeof pre.language !== "string" || typeof child === "string" || !child) return undefined;
  const [codeTag, code, text] = child;
  return codeTag === "code" && typeof text === "string" ? { pre, code, lang: pre.language, text } : undefined;
};

const diagramOf = async (text: string, css: Set<string>): Promise<string | undefined> => {
  let svg: string;
  try {
    svg = await renderMermaidSVGAsync(text, DIAGRAM);
  } catch {
    return undefined;
  }
  const width = Math.ceil(Number(/width="([\d.]+)"/.exec(svg)?.[1]));
  // A comment quotes its block's text, so the CSS leaves the svg, minus the Google Fonts import the offline page never wants.
  const bare = svg.replace(SVG_STYLE, (_, rules: string) => {
    css.add(rules.replace(/@import url\([^)]*\);/g, "").trim());
    return "";
  });
  return `<div class="diagram" style="--natural:${width}px">${bare}</div>`;
};

// A review's original is frozen, so front matter that is not valid YAML must still draw the body.
const nodesOf = async (markdown: string): Promise<MdNode[]> => {
  try {
    return (await parse(markdown)).nodes;
  } catch {
    return (await parse(markdown.replace(FRONT_MATTER, ""))).nodes;
  }
};

const heldOf = (node: MdNode, held: Map<string, Proposal>): Proposal | undefined => {
  if (!isElement(node) || node[0] !== "p") return undefined;
  const text = soleChild(node);
  return typeof text === "string" ? held.get(text) : undefined;
};

const pastedOf = (node: MdNode): string | undefined => {
  if (!isElement(node) || node[0] !== "p") return undefined;
  const img = soleChild(node);
  if (!img || !isElement(img) || img[0] !== "img") return undefined;
  const { alt, src } = img[1];
  if (typeof src !== "string" || !Uploads.isLink(src)) return undefined;
  const label = escapeHtml(typeof alt === "string" ? alt : "");
  const name = escapeHtml(src.split("/").at(-1) ?? "");
  return `<figure class="pasted"><img${attrsOf(img[1])}><figcaption><span>${label}</span><span class="name">pasted · ${name}</span><a class="preview" href="${escapeHtml(src)}" target="_blank" rel="noopener">Preview</a></figcaption></figure>`;
};

const htmlOf = async (node: MdNode, ctx: Context): Promise<string> => {
  if (typeof node === "string") return escapeHtml(node);
  const proposal = heldOf(node, ctx.held);
  if (proposal) return proposalOf(proposal, ctx);
  const pasted = pastedOf(node);
  if (pasted) return pasted;
  const fence = fenceOf(node);
  const diagram = fence?.lang === "mermaid" ? await diagramOf(fence.text, ctx.css) : undefined;
  if (diagram) return diagram;
  if (fence)
    return `<pre${attrsOf(fence.pre)}><code${attrsOf(fence.code)}>${await Syntax.code(fence.text, fence.lang)}</code></pre>`;
  const [tag, props, ...children] = node;
  if (!tag) return "";
  const open = `<${tag}${attrsOf(props)}>`;
  if (VOID.has(tag)) return open;
  return `${open}${(await Promise.all(children.map((child) => htmlOf(child, ctx)))).join("")}</${tag}>`;
};

const partsOf = async (markdown: string, ctx: Context): Promise<string> =>
  (await Promise.all((await nodesOf(markdown)).map((node) => htmlOf(node, ctx)))).join("");

const proposalOf = async ({ id, next, old }: Proposal, ctx: Context): Promise<string> =>
  `<del data-sc-edit="${id}">${await partsOf(old, ctx)}</del><ins data-sc-edit="${id}">${await partsOf(next, ctx)}</ins>`;

const sectionsOf = async (nodes: MdNode[], ctx: Context): Promise<string> => {
  const sections: string[][] = [];
  for (const node of nodes) {
    const html = await htmlOf(node, ctx);
    if (!html.trim()) continue;
    // Each h1 or h2 opens a section, which is the host the read view takes a comment's label from.
    const opens = typeof node !== "string" && (node[0] === "h1" || node[0] === "h2");
    if (opens || !sections.length) sections.push([]);
    sections.at(-1)?.push(html);
  }
  const html = sections.map((parts) => `<section class="flow">${parts.join("")}</section>`).join("\n");
  // Last rather than first, where `.page > * + *` would push the opening section down.
  return ctx.css.size ? `${html}\n<style>${[...ctx.css].join("\n")}</style>` : html;
};

export const bodyOf = async (markdown: string, task?: ArtifactTask): Promise<string> => {
  const { held, text } = Proposals.hold(markdown);
  const nodes = await nodesOf(text);
  return sectionsOf(task ? TaskPage.shape(nodes) : nodes, { css: new Set(), held });
};
