import { createHash } from "node:crypto";
import { open, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import type {
  ArtifactDetail,
  ArtifactFormat,
  ArtifactKind,
  ArtifactMeta,
  ReviewThread,
  ThreadAnchor,
  ThreadReply,
} from "../../shared/types/artifact";
import { FileKind } from "../../shared/utils/file-kind.ts";
import { Sidecar, plansHome } from "../../lib/sidecar/paths.ts";
import {
  commentsFile,
  hasLegacyBlock,
  isStoredDocument,
  MD_SEED,
  readComments,
  withoutLegacyBlock,
  writeComments,
} from "../../lib/sidecar/comments.ts";
import { Tracked } from "../../lib/sidecar/tracked.ts";
import { listRecords, readRecord, recordPath, type WebRecord, writeRecord } from "../../lib/web/records.ts";
import { Markdown } from "./markdown/index.ts";
import { NotebookFormat } from "./notebooks/format.ts";
import { Documents } from "./sessions/artifact-lists.ts";
import { Watched } from "./watched.ts";

const META_BLOCK = /<!--\s*artifact\b([\s\S]*?)-->/;
const TITLE_TAG = /<title>([\s\S]*?)<\/title>/i;
const RV_SEED = /<script type="application\/json" id="rv-seed">([\s\S]*?)<\/script>/;
const MD_SEED_START = "<!-- rv:seed\n";
const COMMENT = /<!--[\s\S]*?-->/g;
const FENCE = /^(```|~~~)[\s\S]*?^\1/gm;
const H1 = /^#[ \t]+(.+?)[ \t#]*$/m;
const RV_LAYER = /<!-- rv:start -->[\s\S]*?<!-- rv:end -->\n?/;
export const RV_LAYER_START = /<!-- rv:start -->/;
type MetaField = "slug" | "title" | "url" | "target" | "ds" | "updated";
const META_FIELDS = new Set<MetaField>(["slug", "title", "url", "target", "ds", "updated"]);
const HEAD_BYTES = 4000;
// Slug becomes a filename on disk; reject anything that could climb out of the artifacts dir.
const SAFE_SLUG = /^[a-zA-Z0-9._-]+$/;
// A pre-build source, never an artifact. One constant, so listing and direct access cannot diverge.
const SRC_SUFFIX = ".src.html";
// Precedence on a slug clash: a page beside a same-named .md is the artifact, and the .md its brief.
const FORMATS: ArtifactFormat[] = ["html", "ipynb", "md"];
const FORMAT_OF: Partial<Record<FileKind, ArtifactFormat>> = { markdown: "md", notebook: "ipynb", page: "html" };
// A notebook carries its plots inline, so past this its title is not worth reading the whole file for.
const NOTEBOOK_BYTES = 4 * 1024 * 1024;

function formatOf(path: string): ArtifactFormat {
  const kind = FileKind.of(path);
  return (kind && FORMAT_OF[kind]) || "media";
}

// The list route touches every file in the dir, so a partial fd read beats loading each one whole.
async function readHead(path: string, bytes: number = HEAD_BYTES): Promise<string> {
  const handle = await open(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

interface ParseMetaInput {
  format: ArtifactFormat;
  head: string;
  fallbackSlug: string;
  path: string;
}

function kindOf(path: string): ArtifactKind {
  const folder = dirname(path);
  if (folder === Sidecar.artifacts()) return "page";
  return folder === plansHome() ? "plan" : "document";
}

function titleOf(head: string, format: ArtifactFormat): string {
  if (format === "html") return TITLE_TAG.exec(head)?.[1]?.trim() || "";
  return H1.exec(head.replace(COMMENT, "").replace(FENCE, ""))?.[1] || "";
}

function parseMeta({ format, head, fallbackSlug, path }: ParseMetaInput): ArtifactMeta {
  const fields: Partial<Record<MetaField, string>> = {};
  const block = META_BLOCK.exec(head)?.[1];
  if (block) {
    for (const line of block.split("\n")) {
      const i = line.indexOf(":");
      if (i === -1) continue;
      const key = line.slice(0, i).trim().toLowerCase() as MetaField;
      if (META_FIELDS.has(key)) fields[key] = line.slice(i + 1).trim();
    }
  }
  // A document's slug carries a hash, so its own file name reads better than a deslugged fallback.
  const title = fields.title || titleOf(head, format) || (format === "md" ? basename(path, ".md") : "");
  // A local showpiece owns its own doctype; a published one never does, and a .md is never published. Mirrors readMeta in Mode's lib/artifact/store.ts.
  const target = fields.target || (format === "md" || /^\s*<!doctype/i.test(head) ? "s" : "b");
  return {
    slug: fields.slug || fallbackSlug,
    title,
    url: fields.url,
    target,
    ds: fields.ds,
    updated: fields.updated,
    path,
    format,
    kind: kindOf(path),
  };
}

interface DescribeInput {
  file: ArtifactFile;
  path: string;
  text: string;
}

const DESCRIBE: Record<ArtifactFormat, (input: DescribeInput) => ArtifactMeta> = {
  html: ({ file, path, text }) => parseMeta({ format: file.format, head: text, fallbackSlug: file.slug, path }),
  md: ({ file, path, text }) => parseMeta({ format: file.format, head: text, fallbackSlug: file.slug, path }),
  ipynb: ({ file, path, text }) => {
    const notebook = NotebookFormat.parse(text);
    const title = (notebook && NotebookFormat.titleOf(notebook)) || basename(path, extname(path));
    return { format: "ipynb", kind: kindOf(path), path, slug: file.slug, target: "s", title };
  },
  media: ({ file, path }) => ({
    format: "media",
    kind: kindOf(path),
    path,
    slug: file.slug,
    target: "s",
    title: basename(path),
  }),
};

// external contract: validating the shape of raw JSON.parse output read off disk
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && !!x;
}

function toReply(raw: unknown): ThreadReply | undefined {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.body !== "string") return undefined;
  return {
    id: raw.id,
    by: typeof raw.by === "string" ? raw.by : "user",
    at: typeof raw.at === "string" ? raw.at : "",
    body: raw.body,
  };
}

export function toAnchor(raw: unknown): ThreadAnchor | undefined {
  if (!isRecord(raw)) return undefined;
  const label = typeof raw.label === "string" ? raw.label : undefined;
  const page = typeof raw.page === "string" ? raw.page : undefined;
  const quote = typeof raw.quote === "string" ? raw.quote : undefined;
  const sel = typeof raw.sel === "string" ? raw.sel : undefined;
  const text = typeof raw.text === "string" ? raw.text : undefined;
  return label || quote || sel || text ? { label, page, quote, sel, text } : undefined;
}

function toThread(raw: unknown): ReviewThread | undefined {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.n !== "number") return undefined;
  const replies = Array.isArray(raw.replies)
    ? raw.replies.map(toReply).filter((r): r is ThreadReply => Boolean(r))
    : [];
  return {
    id: raw.id,
    n: raw.n,
    by: typeof raw.by === "string" ? raw.by : "user",
    at: typeof raw.at === "string" ? raw.at : "",
    updated: typeof raw.updated === "string" ? raw.updated : undefined,
    body: typeof raw.body === "string" ? raw.body : "",
    status: raw.status === "resolved" ? "resolved" : "open",
    anchor: toAnchor(raw.anchor),
    replies,
  };
}

function seedOf(text: string, format: ArtifactFormat): string | undefined {
  return format === "md" ? MD_SEED.exec(text)?.[2] : RV_SEED.exec(text)?.[1];
}

function threadsOf(raw: unknown): ReviewThread[] {
  return Array.isArray(raw) ? raw.map(toThread).filter((t): t is ReviewThread => Boolean(t)) : [];
}

function parseThreads(text: string, format: ArtifactFormat): ReviewThread[] {
  const captured = seedOf(text, format);
  if (!captured) return [];
  let doc: unknown;
  try {
    doc = JSON.parse(captured);
  } catch {
    return []; // a half-written seed block reads as no threads rather than crashing the route
  }
  return threadsOf(isRecord(doc) ? doc.threads : undefined);
}

// The review layer sits after the seed and measures ~30 KB, so the window has to clear it.
const TAIL_BYTES = 96 * 1024;
// Inline pack CSS puts <body> at a measured p50 of 33 KB, max 45 KB, well past the meta window.
const BODY_BYTES = 64 * 1024;
const PREVIEW_CHARS = 220;
const BODY_TAG = /<body[^>]*>/i;
const NOT_PROSE = /<(script|style|svg|template)[\s\S]*?<\/\1>/gi;
const TAGS = /<[^>]+>/g;
export const ENTITY: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
};

function previewOf(head: string): string | undefined {
  const at = BODY_TAG.exec(head);
  if (!at) return undefined;
  const text = head
    .slice(at.index + at[0].length)
    .replace(NOT_PROSE, " ")
    .replace(TAGS, " ")
    .replace(/&([a-z#0-9]+);/gi, (whole, name: string) => ENTITY[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, PREVIEW_CHARS) : undefined;
}

async function readTail(path: string, size: number): Promise<string> {
  const length = Math.min(TAIL_BYTES, size);
  const handle = await open(path, "r");
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buf, 0, length, size - length);
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

// Undefined rather than 0 when the window missed the seed: no layer and an unread one differ.
function countThreads({
  format,
  tail,
  whole,
}: {
  format: ArtifactFormat;
  tail: string;
  whole: boolean;
}): number | undefined {
  if (format === "md") {
    if (tail.includes(MD_SEED_START)) return parseThreads(tail, format).length;
    // A .md grows its block with the first thread, so a file read whole without one has none.
    return whole ? 0 : undefined;
  }
  if (!RV_LAYER_START.test(tail)) return undefined;
  return RV_SEED.test(tail) ? parseThreads(tail, format).length : undefined;
}

interface ArtifactFile {
  format: ArtifactFormat;
  name: string;
  slug: string;
}

function fileOf(name: string): ArtifactFile | undefined {
  if (name.endsWith(SRC_SUFFIX)) return undefined;
  const format = FORMATS.find((one) => name.endsWith(`.${one}`));
  return format ? { format, name, slug: name.slice(0, -format.length - 1) } : undefined;
}

async function artifactFiles(dir: string): Promise<ArtifactFile[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const best = new Map<string, ArtifactFile>();
  for (const file of names.map(fileOf)) {
    const held = file && best.get(file.slug);
    if (file && (!held || FORMATS.indexOf(file.format) < FORMATS.indexOf(held.format))) best.set(file.slug, file);
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Each row costs 160 KB of reads, so a list that has not changed on disk is answered from here.
const listed = new Map<string, { size: number; mtimeMs: number; storeMtimeMs?: number; meta: ArtifactMeta }>();

interface MetaOfInput {
  file: ArtifactFile;
  path: string;
  stats: { size: number; mtimeMs: number };
  stored: boolean;
}

async function metaOf({ file, path, stats, stored }: MetaOfInput): Promise<ArtifactMeta> {
  // A stored document's threads change without touching the document, so its store is part of the cache key.
  const storeMtimeMs = stored ? (await stat(commentsFile(path)).catch(() => undefined))?.mtimeMs : undefined;
  const hit = listed.get(path);
  if (hit && hit.size === stats.size && hit.mtimeMs === stats.mtimeMs && hit.storeMtimeMs === storeMtimeMs)
    return hit.meta;
  const meta = await READ_META[file.format]({ file, path, stats, stored });
  listed.set(path, { size: stats.size, mtimeMs: stats.mtimeMs, storeMtimeMs, meta });
  return meta;
}

async function pageMeta({ file, path, stats, stored }: MetaOfInput): Promise<ArtifactMeta> {
  const [head, tail] = await Promise.all([readHead(path, BODY_BYTES), readTail(path, stats.size)]);
  const comments = stored ? readComments(path, tail) : undefined;
  return {
    ...DESCRIBE[file.format]({ file, path, text: head.slice(0, HEAD_BYTES) }),
    threadCount: comments
      ? threadsOf(comments.threads).length
      : countThreads({ format: file.format, tail, whole: stats.size <= TAIL_BYTES }),
    preview: previewOf(file.format === "md" ? `<body>${await Markdown.body(head)}` : head),
  };
}

const storedCount = (path: string): number => threadsOf(readComments(path, "")?.threads).length;

const READ_META: Record<ArtifactFormat, (input: MetaOfInput) => Promise<ArtifactMeta>> = {
  html: pageMeta,
  md: pageMeta,
  ipynb: async ({ file, path, stats }) => {
    const text = stats.size <= NOTEBOOK_BYTES ? await readFile(path, "utf8") : "";
    return { ...DESCRIBE.ipynb({ file, path, text }), threadCount: storedCount(path) };
  },
  media: async ({ file, path }) => ({ ...DESCRIBE.media({ file, path, text: "" }), threadCount: storedCount(path) }),
};

function webMeta(record: WebRecord): ArtifactMeta {
  return {
    format: "html",
    kind: "web",
    path: recordPath(record.slug),
    slug: record.slug,
    target: "s",
    threadCount: threadsOf(record.threads).length,
    title: record.title || new URL(record.url).host,
    updated: record.updated,
    url: record.url,
  };
}

// A file a link opened is listed as a file even when a conversation also wrote it.
function outsidePaths(): Map<string, string> {
  return new Map([...Documents.paths(), ...Tracked.paths()]);
}

export async function listArtifacts(): Promise<ArtifactMeta[]> {
  const dir = Sidecar.artifacts();
  const tracked = Tracked.paths();
  const outside = [...outsidePaths()].map(([slug, path]) => ({ file: documentFile({ path, slug }), path }));
  const sources = [...(await artifactFiles(dir)).map((file) => ({ file, path: join(dir, file.name) })), ...outside];
  const rows = listRecords().map((record) => ({ meta: webMeta(record), mtime: Date.parse(record.updated) || 0 }));
  for (const { file, path } of sources) {
    try {
      const stats = await stat(path);
      const meta = await metaOf({ file, path, stats, stored: isStoredDocument(path, dir) });
      rows.push({
        meta: tracked.has(meta.slug) ? { ...meta, kind: "file" } : meta,
        mtime: stats.mtimeMs,
      });
    } catch {
      // vanished or unreadable between the readdir and the read: drop it rather than fail the whole list
    }
  }
  return rows.sort((a, b) => b.mtime - a.mtime).map((r) => r.meta);
}

async function artifactFile(slug: string): Promise<(ArtifactFile & { path: string }) | undefined> {
  if (!SAFE_SLUG.test(slug)) return undefined;
  const dir = Sidecar.artifacts();
  for (const format of FORMATS) {
    const file = fileOf(`${slug}.${format}`);
    const path = file ? join(dir, file.name) : undefined;
    const stats = path ? await stat(path).catch(() => undefined) : undefined;
    if (file && path && stats?.isFile()) return { ...file, path };
  }
  const recorded = outsidePaths().get(slug);
  const stats = recorded ? await stat(recorded).catch(() => undefined) : undefined;
  return recorded && stats?.isFile() ? { ...documentFile({ path: recorded, slug }), path: recorded } : undefined;
}

function documentFile({ path, slug }: { path: string; slug: string }): ArtifactFile {
  return { format: formatOf(path), name: basename(path), slug };
}

async function readWhole(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

export interface ArtifactSource extends ArtifactMeta {
  text: string;
}

export async function readArtifact(slug: string): Promise<ArtifactSource | undefined> {
  const record = readRecord(slug);
  if (record) return { ...webMeta(record), text: "" };
  const file = await artifactFile(slug);
  if (!file) return undefined;
  const text = file.format === "media" ? "" : ((await readWhole(file.path)) ?? "");
  if (!text && file.format !== "media") return undefined;
  const head = file.format === "ipynb" ? text : text.slice(0, HEAD_BYTES);
  const meta = DESCRIBE[file.format]({ file: { ...file, slug }, path: file.path, text: head });
  return { ...meta, kind: Tracked.paths().has(slug) ? "file" : meta.kind, text };
}

/** The sidecar draws the notes in its own gutter, so the page's own comment surface would be a second one. */
export function stripReviewLayer(html: string): string {
  return html.replace(RV_LAYER, "");
}

export async function getArtifact(slug: string): Promise<ArtifactDetail | undefined> {
  const source = await readArtifact(slug);
  if (!source) return undefined;
  const { text, ...meta } = source;
  if (meta.kind === "web") {
    const record = readRecord(slug);
    return { ...meta, threads: threadsOf(record?.threads), trail: record?.trail };
  }
  if (isStoredArtifact(meta.path)) return { ...meta, threads: threadsOf(readComments(meta.path, text)?.threads) };
  return { ...meta, threads: parseThreads(text, meta.format) };
}

export async function writeArtifact({ path, text }: { path: string; text: string }): Promise<void> {
  await writeFile(path, text, "utf8");
  listed.delete(path);
  Watched.own(path, await Watched.signatureOf(path));
}

// A comment rewrites the seed inside a page or a .md, so what a reader shows is told apart from the threads stored in it.
export async function contentSignature({ format, path }: Pick<ArtifactMeta, "format" | "path">): Promise<string> {
  if (format !== "html" && format !== "md") return Watched.signatureOf(path);
  const text = await readFile(path, "utf8");
  const shown = format === "md" ? text.replace(MD_SEED, "") : text.replace(RV_LAYER, "").replace(RV_SEED, "");
  return createHash("sha1").update(shown).digest("hex");
}

function parseSeed(text: string, format: ArtifactFormat): Record<string, unknown> | undefined {
  // A .md has nothing to install first, so no block is an empty one; an unreadable block is still refused.
  if (format === "md" && !MD_SEED.test(text)) return { v: 1, threads: [] };
  const captured = seedOf(text, format);
  if (!captured) return undefined;
  try {
    const doc = JSON.parse(captured) as unknown;
    return isRecord(doc) ? doc : undefined;
  } catch {
    return undefined;
  }
}

interface WriteSeedInput {
  format: ArtifactFormat;
  seed: Record<string, unknown>;
  text: string;
}

// Replacer functions, not strings: a `$&` typed into a comment would otherwise be expanded by String.replace.
function writeSeed({ format, seed, text }: WriteSeedInput): string {
  if (format === "md") {
    // `-->` in a comment body would end the block early; the escape reads back as the same text.
    const block = `${MD_SEED_START}${JSON.stringify(seed).replace(/-->/g, "--\\u003e")}\n-->\n`;
    return MD_SEED.test(text) ? text.replace(MD_SEED, () => block) : `${text.replace(/\n*$/, "\n\n")}${block}`;
  }
  if (!RV_SEED.test(text)) return text;
  const json = JSON.stringify(seed).replace(/</g, "\\u003c");
  return text.replace(RV_SEED, () => `<script type="application/json" id="rv-seed">${json}</script>`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function uid8(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export type ArtifactReviewFail = "invalid" | "not-found" | "no-seed";

export type ArtifactReviewOutcome =
  | { ok: true; text: string; thread?: ReviewThread; threads: ReviewThread[] }
  | { ok: false; reason: ArtifactReviewFail };

interface ThreadChangeInput {
  action: "create" | "reply" | "resolve";
  anchor?: ThreadAnchor;
  body?: string;
  by?: string;
  id?: string;
  threads: ReviewThread[];
}

export type ThreadChange =
  { ok: true; thread?: ReviewThread; threads: ReviewThread[] } | { ok: false; reason: ArtifactReviewFail };

function changeThreads(input: ThreadChangeInput): ThreadChange {
  const { threads } = input;

  if (input.action === "create") {
    const body = input.body?.trim();
    if (!body) return { ok: false, reason: "invalid" };
    const thread: ReviewThread = {
      id: uid8(),
      n: threads.reduce((max, one) => Math.max(max, one.n), 0) + 1,
      by: "user",
      at: nowIso(),
      updated: nowIso(),
      body,
      status: "open",
      anchor: input.anchor,
      replies: [],
    };
    const next = [...threads, thread];
    return { ok: true, thread, threads: next };
  }

  if (!input.id) return { ok: false, reason: "invalid" };
  const at = threads.findIndex((one) => one.id === input.id);
  const held = threads[at];
  if (at < 0 || !held) return { ok: false, reason: "not-found" };

  if (input.action === "resolve") {
    const thread: ReviewThread = { ...held, status: "resolved", updated: nowIso() };
    const next = threads.map((one, i) => (i === at ? thread : one));
    return { ok: true, thread, threads: next };
  }

  const body = input.body?.trim();
  if (!body) return { ok: false, reason: "invalid" };
  const reply: ThreadReply = { id: uid8(), by: input.by || "user", at: nowIso(), body };
  const thread: ReviewThread = {
    ...held,
    updated: nowIso(),
    replies: [...held.replies, reply],
  };
  const next = threads.map((one, i) => (i === at ? thread : one));
  return { ok: true, thread, threads: next };
}

export function applyReviewChange(input: {
  action: "create" | "reply" | "resolve";
  anchor?: ThreadAnchor;
  body?: string;
  by?: string;
  format: ArtifactFormat;
  id?: string;
  text: string;
}): ArtifactReviewOutcome {
  const seed = parseSeed(input.text, input.format);
  if (!seed) return { ok: false, reason: "no-seed" };
  const threads = Array.isArray(seed.threads)
    ? seed.threads.map(toThread).filter((t): t is ReviewThread => Boolean(t))
    : [];
  const change = changeThreads({ ...input, threads });
  if (!change.ok) return change;
  const text = writeSeed({ format: input.format, seed: { ...seed, threads: change.threads }, text: input.text });
  return { ...change, text };
}

/** A document outside the artifacts folder keeps its threads in the sidecar's store, and its text changes only to lose an old block. */
export function applyStoredReview(
  input: Omit<ThreadChangeInput, "threads"> & { path: string; text: string },
): ArtifactReviewOutcome {
  const doc = readComments(input.path, input.text);
  const change = changeThreads({ ...input, threads: threadsOf(doc?.threads) });
  if (!change.ok) return change;
  writeComments(input.path, { ...doc, threads: change.threads });
  return { ...change, text: hasLegacyBlock(input.text) ? withoutLegacyBlock(input.text) : input.text };
}

export function applyWebReview(input: Omit<ThreadChangeInput, "threads"> & { slug: string }): ThreadChange {
  const record = readRecord(input.slug);
  if (!record) return { ok: false, reason: "not-found" };
  const change = changeThreads({ ...input, threads: threadsOf(record.threads) });
  if (change.ok) writeRecord({ ...record, threads: change.threads });
  return change;
}

export function isStoredArtifact(path: string): boolean {
  return isStoredDocument(path, Sidecar.artifacts());
}
