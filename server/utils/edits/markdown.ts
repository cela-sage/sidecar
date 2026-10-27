import { Blocks } from "../markdown/blocks.ts";
import { Proposals } from "../markdown/proposals.ts";
import type { ArtifactEditFail } from "./html.ts";

export type MarkdownEditOutcome = { id?: string; ok: true; text: string } | { ok: false; reason: ArtifactEditFail };

interface ApplyInput {
  replacement: string;
  selection: string;
  text: string;
}

interface ResolveInput {
  action: "accept" | "revert";
  id: string;
  text: string;
}

const apply = ({ replacement, selection, text }: ApplyInput): MarkdownEditOutcome => {
  const next = replacement.trim();
  const old = selection.replace(/(?:\r?\n)+$/, "");
  if (!next || !old.trim()) return { ok: false, reason: "invalid" };
  const pending = Proposals.find(text);
  const hits = Blocks.of(text).filter(
    (block) => block.text === old && !pending.some((one) => block.from < one.to && block.to > one.from),
  );
  const [hit] = hits;
  if (!hit) return { ok: false, reason: "stale" };
  if (hits.length > 1) return { ok: false, reason: "ambiguous" };
  const id = Proposals.mint();
  const proposal = Proposals.format({ id, next, old });
  return { id, ok: true, text: `${text.slice(0, hit.from)}${proposal}${text.slice(hit.to)}` };
};

const resolve = ({ action, id, text }: ResolveInput): MarkdownEditOutcome => {
  if (!id.trim()) return { ok: false, reason: "invalid" };
  const found = Proposals.find(text).find((one) => one.id === id.trim());
  if (!found) return { ok: false, reason: "not-found" };
  const kept = action === "accept" ? found.next : found.old;
  return { ok: true, text: `${text.slice(0, found.from)}${kept}${text.slice(found.to)}` };
};

export const MarkdownEdits = { apply, resolve };
