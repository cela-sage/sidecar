import type { ArtifactFormat, ReviewThread, ThreadAnchor, ThreadReply } from "../../shared/types/artifact";
import {
  hasLegacyBlock,
  MD_SEED,
  readComments,
  withoutLegacyBlock,
  writeComments,
} from "../../lib/sidecar/comments.ts";
import { readRecord, writeRecord } from "../../lib/web/records.ts";

export const RV_SEED = /<script type="application\/json" id="rv-seed">([\s\S]*?)<\/script>/;
export const MD_SEED_START = "<!-- rv:seed\n";

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

export function threadsOf(raw: unknown): ReviewThread[] {
  return Array.isArray(raw) ? raw.map(toThread).filter((t): t is ReviewThread => Boolean(t)) : [];
}

export function parseThreads(text: string, format: ArtifactFormat): ReviewThread[] {
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
