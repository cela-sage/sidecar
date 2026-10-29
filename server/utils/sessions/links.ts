import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ArtifactLists } from "../../../lib/sidecar/lists.ts";
import { isFile, readTextSafe } from "../../../lib/files.ts";
import { Sidecar, expandHome } from "../../../lib/sidecar/paths.ts";
import * as Events from "../../../lib/sidecar/events.ts";
import { Tracked } from "../../../lib/sidecar/tracked.ts";
import { findRecord, openRecord, recordPath } from "../../../lib/web/records.ts";
import { FileKind } from "../../../shared/utils/file-kind.ts";
import { artifactsOf } from "./artifact-lists.ts";
import { conversationOf, type ConversationGrowth } from "./conversation.ts";
import { isKey } from "./paths.ts";

const FENCED = /```[\s\S]*?(?:```|$)/g;
const INLINE = /`[^`\n]*`/g;
const WEB = /https?:\/\/[^\s<>"'`\]]+/gi;
const TRAILING = /[.,;:!?*_]+$/;
const BREAK = /[\s`*()<>[\]"']+/;
const AT_LINE = /(?::\d+)+$|#.*$/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const WEB_TOOLS = new Set(["WebFetch", "WebSearch"]);

export interface LinkAdoption extends ConversationGrowth {
  /** Said just now, so it is announced the way a new page is; a catch-up on older turns lands quietly. */
  isLive?: boolean;
}

export interface LinkCatchUp {
  key: string;
  path: string;
  until?: number;
}

interface Ledger {
  isResearch?: boolean;
  links: string[];
  offset: number;
  reply?: string;
}

interface SitePlacing {
  held: string[];
  href: string;
  isLive: boolean;
  key: string;
}

interface FilePlacing {
  isLive: boolean;
  key: string;
  path: string;
}

const count = (text: string, char: string): number => text.split(char).length - 1;
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : [];

// A markdown link's closing paren rides along on the match, while one the address itself opened stays.
function trimmed(match: string): string {
  let url = match.replace(TRAILING, "");
  while (url.endsWith(")") && count(url, "(") < count(url, ")")) url = url.slice(0, -1).replace(TRAILING, "");
  return url;
}

function addressesIn(text: string): string[] {
  const out = new Set<string>();
  for (const [match] of text.matchAll(WEB)) {
    const url = trimmed(match);
    if (URL.canParse(url)) out.add(new URL(url).href);
  }
  return [...out];
}

const linksOf = (text: string): string[] => addressesIn(text.replace(FENCED, " ").replace(INLINE, " "));

function pathOf(word: string): string | undefined {
  const given = word.replace(TRAILING, "").replace(AT_LINE, "").replace(TRAILING, "");
  if (!/^file:/i.test(given)) return SCHEME.test(given) ? undefined : expandHome(given);
  try {
    return fileURLToPath(given);
  } catch {
    return undefined;
  }
}

// Unlike an address, a path counts in inline code, since backticks are how a path is usually written.
function pathsIn(text: string): string[] {
  const out = new Set<string>();
  for (const word of text.replace(FENCED, " ").split(BREAK)) {
    const given = pathOf(word);
    if (!given || !isAbsolute(given) || !FileKind.of(given) || !isFile(given)) continue;
    const real = realpathSync(given);
    if (Tracked.isTrackable(real)) out.add(real);
  }
  return [...out];
}

function ledgerPath(key: string): string {
  return join(Sidecar.home(), "links", `${key}.json`);
}

function ledgerOf(file: string): Ledger {
  try {
    const { isResearch, links, offset, reply } = JSON.parse(readTextSafe(file) ?? "") as Partial<Ledger>;
    return {
      isResearch: isResearch === true || undefined,
      links: strings(links),
      offset: typeof offset === "number" ? offset : 0,
      reply: typeof reply === "string" ? reply : undefined,
    };
  } catch {
    return { links: [], offset: 0 };
  }
}

function placeSite({ held, href, isLive, key }: SitePlacing): void {
  const url = new URL(href);
  if (findRecord({ among: held, url })) return;
  const { record: made } = openRecord({ url });
  ArtifactLists.record(made.slug, key);
  held.push(made.slug);
  if (isLive)
    Events.publish({
      topic: "artifact.created",
      key,
      data: { slug: made.slug, title: url.host, path: recordPath(made.slug) },
    });
}

// A new page in the folder is announced by the artifacts plugin, so announcing it here too would toast it twice.
function placeFile({ isLive, key, path }: FilePlacing): void {
  const showing = artifactsOf(key);
  const slug = Tracked.enter(path, key);
  if (isLive && !showing.includes(slug) && !Tracked.isPage(path))
    Events.publish({ topic: "artifact.created", key, data: { slug, title: basename(path), path } });
}

// Only what a turn hands over lists: a message's links and pages, and the reply that ends Claude's turn, never its narration.
function adopt({ key, isLive = false, offset, turns }: LinkAdoption): void {
  if (!isKey(key)) return;
  const file = ledgerPath(key);
  const ledger = ledgerOf(file);
  if (offset <= ledger.offset) return;
  const links = new Set(ledger.links);
  const held = ArtifactLists.entries(key);
  let { isResearch, reply } = ledger;
  const take = (said: string, place: () => void): void => {
    if (links.has(said)) return;
    links.add(said);
    place();
  };
  const takeSite = (href: string): void => take(href, () => placeSite({ held, href, isLive, key }));
  const takeFile = (local: string): void => take(local, () => placeFile({ isLive, key, path: local }));
  const handOver = (): void => {
    if (reply && !isResearch) for (const href of linksOf(reply)) takeSite(href);
    if (reply) for (const local of pathsIn(reply)) takeFile(local);
    reply = undefined;
    isResearch = undefined;
  };
  for (const turn of turns) {
    if (turn.role === "user") {
      if (!turn.queued && !turn.joined) handOver();
      for (const href of linksOf(turn.text)) takeSite(href);
      for (const local of pathsIn(turn.text)) if (Tracked.isPage(local)) takeFile(local);
    } else if (turn.kind === "end") handOver();
    else if (turn.kind === "narration" || turn.kind === "answer") reply = turn.text;
    else if (turn.kind === "acting" && WEB_TOOLS.has(turn.tool ?? "")) isResearch = true;
  }
  mkdirSync(dirname(file), { recursive: true });
  const next: Ledger = { isResearch, links: [...links], offset, reply };
  writeFileSync(file, `${JSON.stringify(next)}\n`);
}

function settled(work: () => void, key: string): void {
  try {
    work();
  } catch (error) {
    console.error(`[links] could not adopt the links of ${key}`, error);
  }
}

export const Links = {
  adopt: (growth: LinkAdoption): void => settled(() => adopt(growth), growth.key),
  catchUp: ({ key, path, until }: LinkCatchUp): void =>
    settled(() => {
      const since = ledgerOf(ledgerPath(key)).offset;
      adopt({ key, path, ...conversationOf({ key, path, since, until }) });
    }, key),
  ledger: ledgerPath,
  of: linksOf,
};
