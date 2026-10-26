import { proxyFetch } from "httpxy";
import { siteAgents } from "../../../lib/web/records.ts";
import { reachOf } from "./proxy.ts";

export interface Followed {
  at: URL;
  response: Response;
}

export interface FollowOptions {
  accept: string;
  userAgent?: string;
}

const HOPS = 5;
const WAIT = 4000;
const ATTR = /\s([a-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const ENTITY: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };

async function fetchFollowing(start: URL, { accept, userAgent }: FollowOptions): Promise<Followed | undefined> {
  let at = start;
  for (let hop = 0; hop <= HOPS; hop += 1) {
    const reach = await reachOf(at.hostname);
    const headers = new Headers({ accept });
    if (userAgent) headers.set("user-agent", userAgent);
    const response = await proxyFetch(
      at.origin,
      at,
      { headers, redirect: "manual" },
      {
        agent: at.protocol === "https:" ? siteAgents.https : siteAgents.http,
        changeOrigin: true,
        ssl: reach === "loopback" ? { rejectUnauthorized: false } : undefined,
        timeout: WAIT,
      },
    ).catch(() => undefined);
    const to = response?.headers.get("location");
    if (!response || response.status < 300 || response.status >= 400 || !to) return response && { at, response };
    await response.body?.cancel();
    at = new URL(to, at);
    if (at.protocol !== "http:" && at.protocol !== "https:") return undefined;
  }
  return undefined;
}

// Stops at the cap or once the head has closed, since what is read from a page never sits in its body.
async function readUpTo(response: Response, { max, until }: { max: number; until?: string }): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const decoder = new TextDecoder();
  let tail = "";
  while (reader && size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (!until) continue;
    const seen = tail + decoder.decode(value, { stream: true });
    if (seen.includes(until)) break;
    tail = seen.slice(-until.length);
  }
  await reader?.cancel();
  return Buffer.concat(chunks).subarray(0, max);
}

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] !== "#") return ENTITY[body.toLowerCase()] ?? whole;
    const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function tagsOf(html: string, name: "link" | "meta"): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(ATTR)].map(([, key = "", ...value]) => [key.toLowerCase(), decode(value.find(Boolean) ?? "")]),
    ),
  );
}

export const PageHead = { decode, fetchFollowing, readUpTo, tagsOf };
