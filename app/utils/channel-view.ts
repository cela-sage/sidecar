import type { Channel, ChannelPost, SystemLine } from "~~/shared/types/channel";
import { AttachedFiles } from "../../shared/utils/attached-files.ts";
import { UploadedFiles } from "../../shared/utils/uploaded-files.ts";
import { ChannelCast, type Cast, type Segment, type Speaker } from "./channel-cast.ts";
import { andList, shorten } from "./label.ts";
import type { TaskMeta } from "./tasks.ts";

export type ChannelTab = "messages" | "dms" | "document";
export type Raise = "none" | "waiting" | "answered";

export interface OutsideCard {
  key: string;
  name: string;
  read?: string;
  lines: number;
}

export interface ThreadSummary {
  count: number;
  last: string;
  who: Speaker[];
  isWaiting: boolean;
}

export interface PostItem {
  kind: "post";
  id: string;
  at: string;
  speaker: Speaker;
  segments: Segment[];
  pictures: string[];
  raise: Raise;
  answered?: string;
  reach?: string;
  outside: OutsideCard[];
  thread?: ThreadSummary;
  replyTo?: { id: string; text: string };
  isBroadcast: boolean;
}

export interface SystemItem {
  kind: "system";
  id: string;
  at: string;
  who: Speaker[];
  text: string;
  meta: string;
}

export interface DividerItem {
  kind: "divider";
  id: string;
  text: string;
}

export type ChannelItem = PostItem | SystemItem | DividerItem;

export interface DmItem {
  id: string;
  pair: [Speaker, Speaker];
  names: string;
  last: string;
  at: string;
  messages: { at: string; from: Speaker; text: string }[];
}

export interface Crew {
  speakers: Speaker[];
  tip: string;
}

interface Context {
  channel: Channel;
  cast: Cast;
  raised: Set<string>;
}

type Kind = SystemLine["kind"];
type SystemOf<K extends Kind> = Extract<SystemLine, { kind: K }>;
type Said = Pick<SystemItem, "text" | "meta"> & { keys: string[] };

const { namesOf, segmentsOf, speaker, you } = ChannelCast;

const everyLine = (channel: Channel): { at: string }[] => [...channel.lines, ...Object.values(channel.threads).flat()];

const REPLY_TO_MAX = 80;

const headOf = (channel: Channel, id: string): ChannelPost | undefined =>
  channel.lines.find((one): one is ChannelPost => one.kind === "post" && one.id === id && !one.thread);

const shownOf = (text: string): { text: string; paths: string[] } =>
  AttachedFiles.imagesOf(text, (path) => !!UploadedFiles.srcOf(path));

const aboutOf = (post: ChannelPost): string => {
  const { text, paths } = shownOf(post.text);
  return text || (paths[0]?.split("/").at(-1) ?? "");
};

const raiseOf = (post: ChannelPost, raised: Set<string>): Raise => {
  if (raised.has(post.id)) return "waiting";
  return post.reach.boss && post.answered ? "answered" : "none";
};

const reachOf = (post: ChannelPost, cast: Cast, picked: string[]): string | undefined => {
  const { all, boss, notified, missed, outside } = post.reach;
  if (boss) return undefined;
  const away = new Set([...picked, ...outside.map((one) => one.key)]);
  const named = (keys: string[]): string => namesOf(cast, keys.filter((key) => !away.has(key)));
  const reached = all ? "Notified everyone" : named(notified) && `Notified ${named(notified)}`;
  const lost = named(missed) && `missed ${named(missed)}`;
  return [reached, lost].filter(Boolean).join(" · ") || undefined;
};

const summaryOf = (replies: ChannelPost[], { cast, raised }: Context): ThreadSummary => ({
  count: replies.length,
  last: replies.at(-1)?.at ?? "",
  who: [...new Set(replies.map((one) => one.by))].slice(0, 3).map((key) => speaker(cast, key)),
  isWaiting: replies.some((one) => raised.has(one.id)),
});

const postOf = (post: ChannelPost, context: Context, picked: string[] = []): PostItem => {
  const { channel, cast, raised } = context;
  const replies = post.thread ? [] : (channel.threads[post.id] ?? []);
  const reach = reachOf(post, cast, picked);
  const lines = everyLine(channel).filter((one) => one.at <= post.at).length;
  const head = post.thread && post.broadcast ? headOf(channel, post.thread) : undefined;
  const { text, paths } = shownOf(post.text);
  return {
    kind: "post",
    id: post.id,
    at: post.at,
    speaker: speaker(cast, post.by),
    segments: segmentsOf(text, cast),
    pictures: paths,
    raise: raiseOf(post, raised),
    outside: post.reach.outside.map((one) => ({
      key: one.key,
      name: speaker(cast, one.key).name,
      lines,
      ...(one.read ? { read: one.read } : {}),
    })),
    isBroadcast: !!post.broadcast,
    ...(post.answered ? { answered: post.answered } : {}),
    ...(reach ? { reach } : {}),
    ...(replies.length ? { thread: summaryOf(replies, context) } : {}),
    ...(head ? { replyTo: { id: head.id, text: shorten(aboutOf(head), REPLY_TO_MAX) } } : {}),
  };
};

const who = (cast: Cast, by: string): string => (by === you.key ? "you" : speaker(cast, by).name);
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const agents = (by?: string): string[] => (by && by !== you.key ? [by] : []);

const SAY: { [K in Kind]: (line: SystemOf<K>, cast: Cast, title: string) => Said } = {
  join: ({ key, by }, cast) => ({
    keys: [key],
    text: `${speaker(cast, key).name} joined`,
    meta: by ? `· spawned by ${who(cast, by)}` : "",
  }),
  kill: ({ keys, by }, cast) => ({
    keys,
    text: `${namesOf(cast, keys)} ${keys.length === 1 ? "was" : "were"} killed`,
    meta: by ? `· by ${who(cast, by)}` : "",
  }),
  resume: ({ keys, by }, cast) => ({
    keys,
    text: `${namesOf(cast, keys)} ${keys.length === 1 ? "is" : "are"} back`,
    meta: by ? `· resumed by ${who(cast, by)}` : "",
  }),
  archive: ({ by }, cast, title) => ({
    keys: agents(by),
    text: by ? `${capital(who(cast, by))} archived ${title}` : `${title} was archived`,
    meta: "· restore it from Archived in the tree",
  }),
  restore: ({ by }, cast, title) => ({
    keys: agents(by),
    text: by ? `${capital(who(cast, by))} restored ${title}` : `${title} was restored`,
    meta: "· its agents stay killed",
  }),
};

const say = <K extends Kind>(kind: K, line: SystemOf<K>, cast: Cast, title: string): Said =>
  SAY[kind](line, cast, title);

const systemOf = (line: SystemLine, { channel, cast }: Context): SystemItem => {
  const { keys, text, meta } = say(line.kind, line, cast, channel.title);
  return { kind: "system", id: line.id, at: line.at, who: keys.map((key) => speaker(cast, key)), text, meta };
};

const contextOf = (channel: Channel, cast: Cast): Context => ({ channel, cast, raised: new Set(channel.raised) });

const firstNewOf = (channel: Channel, since?: string): string | undefined =>
  since
    ? channel.lines.find((line) => line.at > since && !(line.kind === "post" && line.by === you.key))?.id
    : undefined;

const streamOf = (channel: Channel, cast: Cast, since?: string): ChannelItem[] => {
  const context = contextOf(channel, cast);
  const first = firstNewOf(channel, since);
  return channel.lines.flatMap((line): ChannelItem[] => [
    ...(line.id === first ? [{ kind: "divider" as const, id: `new:${line.id}`, text: "New" }] : []),
    line.kind === "post" ? postOf(line, context) : systemOf(line, context),
  ]);
};

const paneOf = (channel: Channel, cast: Cast, root: string): ChannelItem[] => {
  const context = contextOf(channel, cast);
  const head = headOf(channel, root);
  if (!head) return [];
  const replies = channel.threads[root] ?? [];
  const asked = [head, ...replies].filter((one) => one.reach.boss && !!one.answered);
  const count = replies.length === 1 ? "1 reply" : `${replies.length} replies`;
  const items: ChannelItem[] = [
    postOf(head, context),
    { kind: "divider", id: `count:${root}`, text: replies.length ? count : "No replies yet" },
  ];
  for (const reply of replies) {
    const answered = reply.by === you.key ? asked.filter((one) => one.answered === reply.at) : [];
    const picked = [...new Set(answered.map((one) => one.by))].filter((key) => reply.reach.notified.includes(key));
    items.push(postOf(reply, context, picked));
    if (picked.length)
      items.push({
        kind: "system",
        id: `picked:${reply.id}`,
        at: reply.at,
        who: picked.map((key) => speaker(cast, key)),
        text: `${namesOf(cast, picked)} picked it up`,
        meta: "· it was waiting on you",
      });
  }
  return items;
};

const rootOf = (channel: Channel, id: string): string | undefined => {
  if (headOf(channel, id)) return id;
  return Object.entries(channel.threads).find(([, replies]) => replies.some((one) => one.id === id))?.[0];
};

const latestOf = (channel: Channel): string | undefined =>
  everyLine(channel)
    .map((one) => one.at)
    .sort()
    .at(-1);

const crewOf = (channel: Channel, cast: Cast): Crew => {
  const speakers = channel.members.map((one) => speaker(cast, one.key)).sort(ChannelCast.byName);
  const alive = speakers.filter((one) => !one.isKilled).map((one) => one.name);
  const killed = speakers.filter((one) => one.isKilled).map((one) => one.name);
  const gone = killed.length ? `${andList(killed)} ${killed.length === 1 ? "was" : "were"} killed` : "";
  const tip = [andList(alive), gone, "An agent joins when it is spawned for the work"].filter(Boolean).join(". ");
  return { speakers, tip };
};

const dmsOf = (channel: Channel, cast: Cast): DmItem[] =>
  channel.dms.map(({ pair: [a, b], messages }) => {
    const pair: [Speaker, Speaker] = [speaker(cast, a), speaker(cast, b)];
    const last = messages.at(-1);
    return {
      id: `${a}:${b}`,
      pair,
      names: `${pair[0].name} and ${pair[1].name}`,
      last: last?.text ?? "",
      at: last?.at ?? "",
      messages: messages.map(({ at, from, text }) => ({ at, from: speaker(cast, from), text })),
    };
  });

const closedOf = (channel: Channel, cast: Cast): string => {
  const archive = channel.lines.findLast((one) => one.kind === "archive");
  const by = archive?.by && archive.by !== you.key ? speaker(cast, archive.by).name : undefined;
  const lead = by ? `${by} archived ${channel.title}, so` : `${channel.title} is archived, so`;
  return `${lead} its channel is read only. Restore brings it back with its history.`;
};

const tabFor = (meta?: TaskMeta): ChannelTab => (meta && !meta.task.project ? "document" : "messages");

export const ChannelView = { closedOf, crewOf, dmsOf, firstNewOf, latestOf, paneOf, rootOf, streamOf, tabFor };
