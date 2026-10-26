import type { LinkPreview } from "../../../shared/types/web.ts";
import { Reach } from "../../../lib/web/reach.ts";
import { PageHead } from "./head.ts";
import { reachOf } from "./proxy.ts";

export interface PreviewInput {
  url: URL;
  /** The sidecar browser's own, so the site answers the lookup as it would that browser's tab. */
  userAgent?: string;
}

interface Kept {
  preview: Promise<LinkPreview | undefined>;
  until: number;
}

const HEAD_MAX = 512 * 1024;
const HIT_FOR = 30 * 60 * 1000;
const MISS_FOR = 60 * 1000;
const KEPT_MAX = 256;
const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;

const kept = new Map<string, Kept>();

// An image from a host closer to this machine than its page would let a remote page make the sidecar reach it.
async function imageOf(raw: string | undefined, page: URL): Promise<string | undefined> {
  if (!raw || !URL.canParse(raw, page)) return undefined;
  const image = new URL(raw, page);
  if (image.protocol !== "http:" && image.protocol !== "https:") return undefined;
  const [own, at] = await Promise.all([reachOf(page.hostname), reachOf(image.hostname)]);
  return Reach.rank[at] > Reach.rank[own] ? undefined : image.href;
}

async function lookUp({ url, userAgent }: PreviewInput): Promise<LinkPreview | undefined> {
  const got = await PageHead.fetchFollowing(url, { accept: "text/html,application/xhtml+xml", userAgent });
  const declared = got?.response.headers.get("content-type") ?? "";
  if (!got?.response.ok || (declared && !declared.includes("html"))) {
    await got?.response.body?.cancel();
    return undefined;
  }
  const html = new TextDecoder().decode(await PageHead.readUpTo(got.response, { max: HEAD_MAX, until: "</head>" }));
  const meta = new Map<string, string>();
  for (const attrs of PageHead.tagsOf(html, "meta")) {
    const key = (attrs.property || attrs.name || "").toLowerCase();
    const content = attrs.content?.trim();
    if (key && content && !meta.has(key)) meta.set(key, content);
  }
  const title =
    meta.get("og:title") || meta.get("twitter:title") || PageHead.decode(TITLE.exec(html)?.[1] ?? "").trim();
  const description = meta.get("og:description") || meta.get("twitter:description") || meta.get("description");
  if (!title && !description) return undefined;
  return {
    description,
    image: await imageOf(meta.get("og:image") || meta.get("og:image:url") || meta.get("twitter:image"), got.at),
    site: meta.get("og:site_name") || got.at.hostname.replace(/^www\./, ""),
    title: title || undefined,
    url: got.at.href,
  };
}

export function linkPreview({ url, userAgent }: PreviewInput): Promise<LinkPreview | undefined> {
  const held = kept.get(url.href);
  if (held && held.until > Date.now()) return held.preview;
  if (kept.size >= KEPT_MAX) kept.delete(kept.keys().next().value ?? "");
  const preview = lookUp({ url, userAgent }).catch(() => undefined);
  const entry: Kept = { preview, until: Date.now() + MISS_FOR };
  kept.set(url.href, entry);
  void preview.then((found) => (entry.until = Date.now() + (found ? HIT_FOR : MISS_FOR)));
  return preview;
}
