import type {
  Channel,
  ChannelDm,
  ChannelLine,
  ChannelMember,
  ChannelPost,
  DirectMessage,
} from "../../../shared/types/channel.ts";
import type { Life } from "../../../shared/types/session.ts";
import type { ChannelEntry } from "./store.ts";

type Kind = ChannelEntry["kind"];
type EntryOf<K extends Kind> = Extract<ChannelEntry, { kind: K }>;

export interface Folded {
  joined: Map<string, EntryOf<"join">>;
  life: Map<string, Life>;
  archived: boolean;
  lines: ChannelLine[];
  posts: Map<string, ChannelPost>;
  reads: Map<string, string>;
  dms: Map<string, DirectMessage>;
}

export interface ViewInput {
  slug: string;
  title: string;
  folded: Folded;
  members: ChannelMember[];
}

const by = (said?: string): { by?: string } => (said ? { by: said } : {});

const turned = (folded: Folded, keys: string[], from: Life, to: Life): string[] => {
  const moved = keys.filter((key) => folded.joined.has(key) && folded.life.get(key) === from);
  for (const key of moved) folded.life.set(key, to);
  return moved;
};

const answer = (folded: Folded, thread: string, at: string): void => {
  for (const one of folded.posts.values()) {
    const isIn = one.id === thread || one.thread === thread;
    if (isIn && one.reach.boss && !one.answered) one.answered = at;
  }
};

// Two writers can race a system line in, so a join, kill or resume that changes nothing is dropped here.
const STEPS: { [K in Kind]: (folded: Folded, entry: EntryOf<K>) => void } = {
  post: (folded, { id, at, by: author, text, thread, broadcast, mentions }) => {
    const post: ChannelPost = {
      kind: "post",
      id,
      at,
      by: author,
      text,
      ...(thread ? { thread } : {}),
      ...(thread && broadcast ? { broadcast } : {}),
      reach: {
        ...(mentions.all ? { all: true } : {}),
        ...(mentions.boss ? { boss: true } : {}),
        notified: [],
        missed: [],
        outside: mentions.outside.map((key) => ({ key })),
      },
    };
    if (thread && author === "YOU") answer(folded, thread, at);
    folded.posts.set(id, post);
    folded.lines.push(post);
  },
  reach: (folded, { post, notified, missed }) => {
    const hit = folded.posts.get(post);
    if (!hit) return;
    hit.reach.notified = [...new Set([...hit.reach.notified, ...notified])];
    hit.reach.missed = [...new Set([...hit.reach.missed, ...missed])];
  },
  join: (folded, entry) => {
    if (folded.joined.has(entry.key)) return;
    folded.joined.set(entry.key, entry);
    folded.life.set(entry.key, entry.killed ? "killed" : "alive");
    folded.lines.push({ kind: "join", id: entry.id, at: entry.at, key: entry.key, ...by(entry.by) });
  },
  kill: (folded, entry) => {
    const keys = turned(folded, entry.keys, "alive", "killed");
    if (keys.length) folded.lines.push({ kind: "kill", id: entry.id, at: entry.at, keys, ...by(entry.by) });
  },
  resume: (folded, entry) => {
    const keys = turned(folded, entry.keys, "killed", "alive");
    if (keys.length) folded.lines.push({ kind: "resume", id: entry.id, at: entry.at, keys, ...by(entry.by) });
  },
  archive: (folded, entry) => {
    if (folded.archived) return;
    folded.archived = true;
    folded.lines.push({ kind: "archive", id: entry.id, at: entry.at, ...by(entry.by) });
  },
  restore: (folded, entry) => {
    if (!folded.archived) return;
    folded.archived = false;
    folded.lines.push({ kind: "restore", id: entry.id, at: entry.at, ...by(entry.by) });
  },
  read: (folded, { key, upto, post, at }) => {
    folded.reads.set(key, upto);
    const token = post ? folded.posts.get(post)?.reach.outside.find((one) => one.key === key) : undefined;
    if (token && !token.read) token.read = at;
  },
  dm: (folded, { at, from, to, text }) => {
    const sent = `${at}|${from}|${to}`;
    if (!folded.dms.has(sent)) folded.dms.set(sent, { at, from, to, text });
  },
};

const apply = <K extends Kind>(folded: Folded, kind: K, entry: EntryOf<K>): void => STEPS[kind](folded, entry);

const fold = (entries: ChannelEntry[]): Folded => {
  const folded: Folded = {
    joined: new Map(),
    life: new Map(),
    archived: false,
    lines: [],
    posts: new Map(),
    reads: new Map(),
    dms: new Map(),
  };
  for (const entry of entries) apply(folded, entry.kind, entry);
  return folded;
};

const raisedOf = ({ posts, archived }: Folded): string[] =>
  archived ? [] : [...posts.values()].filter((one) => one.reach.boss && !one.answered).map((one) => one.id);

const dmsOf = ({ dms }: Folded): ChannelDm[] => {
  const pairs = new Map<string, ChannelDm>();
  for (const one of dms.values()) {
    const pair: [string, string] = one.from < one.to ? [one.from, one.to] : [one.to, one.from];
    const dm = pairs.get(pair.join(":")) ?? { pair, messages: [] };
    dm.messages.push(one);
    pairs.set(pair.join(":"), dm);
  }
  return [...pairs.values()].sort((x, y) => (y.messages.at(-1)?.at ?? "").localeCompare(x.messages.at(-1)?.at ?? ""));
};

const view = ({ slug, title, folded, members }: ViewInput): Channel => {
  const threads: Record<string, ChannelPost[]> = {};
  for (const one of folded.lines) {
    if (one.kind === "post" && one.thread) (threads[one.thread] ??= []).push(one);
  }
  return {
    slug,
    title,
    archived: folded.archived,
    raised: raisedOf(folded),
    members,
    lines: folded.lines.filter((one) => one.kind !== "post" || !one.thread || one.broadcast),
    threads,
    dms: dmsOf(folded),
  };
};

export const ChannelFold = { fold, raisedOf, view };
