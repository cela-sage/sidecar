import { ENTITY, RV_LAYER_START } from "../artifacts.ts";

const SKIP_TAGS = new Set(["script", "style", "svg", "template"]);
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const RAW_TAGS = new Set(["script", "style", "svg", "template", "textarea", "title"]);

interface TextAtom {
  ch: string;
  from: number;
  to: number;
}

export type ArtifactEditFail = "ambiguous" | "invalid" | "not-found" | "stale";

export type ArtifactEditOutcome = { html: string; id?: string; ok: true } | { ok: false; reason: ArtifactEditFail };

function decodeEntity(raw: string): string {
  if (raw[0] === "#") {
    const hex = raw[1] === "x" || raw[1] === "X";
    const n = Number.parseInt(raw.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(n) && n ? String.fromCodePoint(n) : `&${raw};`;
  }
  return ENTITY[raw.toLowerCase()] ?? `&${raw};`;
}

function atomsIn(html: string, from: number, to: number): TextAtom[] {
  const out: TextAtom[] = [];
  let i = from;
  let skip = 0;
  while (i < to) {
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end < 0 ? to : end + 3;
      continue;
    }
    if (html[i] === "<") {
      const gt = html.indexOf(">", i);
      if (gt < 0 || gt >= to) break;
      const close = html[i + 1] === "/";
      const name = /^<\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(i, gt + 1))?.[1]?.toLowerCase();
      if (name && SKIP_TAGS.has(name)) skip += close ? -1 : 1;
      if (skip < 0) skip = 0;
      i = gt + 1;
      continue;
    }
    if (skip) {
      i += 1;
      continue;
    }
    if (html[i] === "&") {
      const semi = html.indexOf(";", i + 1);
      if (semi > i && semi < i + 12 && semi < to) {
        out.push({ ch: decodeEntity(html.slice(i + 1, semi)), from: i, to: semi + 1 });
        i = semi + 1;
        continue;
      }
    }
    out.push({ ch: html[i] ?? "", from: i, to: i + 1 });
    i += 1;
  }
  return out;
}

function folded(atoms: TextAtom[]): { at: number[]; text: string } {
  const chars: string[] = [];
  const at: number[] = [];
  let pending = false;
  let started = false;
  for (let i = 0; i < atoms.length; i++) {
    const ch = atoms[i]?.ch ?? "";
    if (!ch) continue;
    if (/\s/.test(ch)) {
      if (started) pending = true;
      continue;
    }
    if (pending) {
      chars.push(" ");
      at.push(at.at(-1) ?? i);
      pending = false;
    }
    chars.push(ch);
    at.push(i);
    started = true;
  }
  return { at, text: chars.join("") };
}

function pageOf(html: string): { page: string; tail: string } {
  const at = html.search(RV_LAYER_START);
  if (at < 0) return { page: html, tail: "" };
  return { page: html.slice(0, at), tail: html.slice(at) };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface El {
  tag: string;
  id?: string;
  edit?: string;
  parent?: El;
  children: El[];
  innerFrom: number;
  innerTo: number;
}

function attrOf(token: string, name: string): string | undefined {
  const re = new RegExp(`(?:\\s|^)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const hit = re.exec(token.slice(1));
  return hit?.[1] || hit?.[2] || hit?.[3] || undefined;
}

function parseTree(html: string): El {
  const root: El = { tag: "#document", children: [], innerFrom: 0, innerTo: html.length };
  const stack: El[] = [root];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[i] !== "<") {
      i += 1;
      continue;
    }
    const gt = html.indexOf(">", i);
    if (gt < 0) break;
    const token = html.slice(i, gt + 1);
    if (token.startsWith("<!") || token.startsWith("<?")) {
      i = gt + 1;
      continue;
    }
    const name = /^<\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(token)?.[1]?.toLowerCase();
    if (!name) {
      i = gt + 1;
      continue;
    }
    if (token.startsWith("</")) {
      for (let s = stack.length - 1; s >= 1; s--) {
        const held = stack[s];
        if (held?.tag !== name) continue;
        held.innerTo = i;
        stack.length = s;
        break;
      }
      i = gt + 1;
      continue;
    }
    const parent = stack[stack.length - 1] ?? root;
    const node: El = {
      tag: name,
      id: attrOf(token, "id") || undefined,
      edit: attrOf(token, "data-sc-edit") || undefined,
      parent,
      children: [],
      innerFrom: gt + 1,
      innerTo: gt + 1,
    };
    parent.children.push(node);
    i = gt + 1;
    if (token.endsWith("/>") || VOID_TAGS.has(name)) continue;
    if (RAW_TAGS.has(name)) {
      const closeAt = html.toLowerCase().indexOf(`</${name}`, i);
      if (closeAt < 0) {
        node.innerTo = html.length;
        i = html.length;
        continue;
      }
      node.innerTo = closeAt;
      const closeGt = html.indexOf(">", closeAt);
      i = closeGt < 0 ? html.length : closeGt + 1;
      continue;
    }
    stack.push(node);
  }
  while (stack.length > 1) {
    const held = stack.pop();
    if (held) held.innerTo = html.length;
  }
  return root;
}

interface PathStep {
  id?: string;
  tag?: string;
  nth?: number;
}

function unescapeCss(raw: string): string {
  return raw.replace(/\\(.)/g, "$1");
}

function stepsOf(path: string): PathStep[] | undefined {
  const steps: PathStep[] = [];
  for (const part of path.trim().split(" > ")) {
    if (part.startsWith("#")) {
      const id = unescapeCss(part.slice(1));
      if (!id) return undefined;
      steps.push({ id });
      continue;
    }
    const hit = /^([a-zA-Z][a-zA-Z0-9]*)(?::nth-of-type\((\d+)\))?$/.exec(part);
    if (!hit?.[1]) return undefined;
    const nth = hit[2] ? Number.parseInt(hit[2], 10) : 0;
    steps.push({ tag: hit[1].toLowerCase(), nth: nth || undefined });
  }
  return steps.length ? steps : undefined;
}

function matchStep(el: El, step: PathStep): boolean {
  if (step.id) return el.id === step.id;
  if (step.tag && el.tag !== step.tag) return false;
  if (!step.nth) return true;
  const kin = (el.parent?.children ?? []).filter((child) => child.tag === el.tag);
  return kin.indexOf(el) + 1 === step.nth;
}

function descendantsOf(el: El): El[] {
  return el.children.flatMap((child) => [child, ...descendantsOf(child)]);
}

function queryPath(root: El, path: string): El[] {
  const steps = stepsOf(path);
  if (!steps) return [];
  const [first, ...rest] = steps;
  if (!first) return [];
  let cur = descendantsOf(root).filter((el) => matchStep(el, first));
  for (const step of rest) {
    cur = cur.flatMap((el) => el.children.filter((child) => matchStep(child, step)));
  }
  return cur;
}

function locatePath(root: El, path: string): { el: El } | { reason: ArtifactEditFail } {
  const all = queryPath(root, path);
  if (all.length > 1) return { reason: "ambiguous" };
  const [el] = all;
  return el ? { el } : { reason: "not-found" };
}

export function applyArtifactEdit(input: {
  html: string;
  path: string;
  replacement: string;
  selection: string;
}): ArtifactEditOutcome {
  const path = input.path.trim();
  const guard = input.selection.replace(/\s+/g, " ").trim();
  if (!path || !guard || !input.replacement) return { ok: false, reason: "invalid" };
  const { page, tail } = pageOf(input.html);
  const found = locatePath(parseTree(page), path);
  if (!("el" in found)) return { ok: false, reason: found.reason };
  if (folded(atomsIn(page, found.el.innerFrom, found.el.innerTo)).text !== guard) return { ok: false, reason: "stale" };
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const prev = page.slice(found.el.innerFrom, found.el.innerTo);
  const wrapped = `<del data-sc-edit="${id}">${prev}</del><ins data-sc-edit="${id}">${escapeHtml(input.replacement)}</ins>`;
  return { html: `${page.slice(0, found.el.innerFrom)}${wrapped}${page.slice(found.el.innerTo)}${tail}`, id, ok: true };
}

export function resolveArtifactEdit(input: {
  action: "accept" | "revert";
  html: string;
  id: string;
  path: string;
}): ArtifactEditOutcome {
  const path = input.path.trim();
  const id = input.id.trim();
  if (!path || !id) return { ok: false, reason: "invalid" };
  const { page, tail } = pageOf(input.html);
  const found = locatePath(parseTree(page), path);
  if (!("el" in found)) return { ok: false, reason: found.reason };
  const inside = descendantsOf(found.el);
  const del = inside.find((el) => el.tag === "del" && el.edit === id);
  const ins = inside.find((el) => el.tag === "ins" && el.edit === id);
  if (!del || !ins) return { ok: false, reason: "not-found" };
  const kept =
    input.action === "accept" ? page.slice(ins.innerFrom, ins.innerTo) : page.slice(del.innerFrom, del.innerTo);
  return { html: `${page.slice(0, found.el.innerFrom)}${kept}${page.slice(found.el.innerTo)}${tail}`, ok: true };
}
