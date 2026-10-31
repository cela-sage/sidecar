import type { Channel } from "~~/shared/types/channel";
import type { AgentFace, LiveSession } from "~~/shared/types/session";
import type { Role } from "~~/shared/types/task";
import { Handles } from "../../shared/utils/handles.ts";
import { Titles } from "../../shared/utils/titles.ts";
import { andList } from "./label.ts";

export type Tone = "agent" | "all" | "boss" | "out";

export interface Speaker {
  key: string;
  kind: "you" | "assistant" | "agent";
  name: string;
  work: string;
  role?: Role;
  face?: AgentFace;
  token?: string;
  isMember: boolean;
  isKilled: boolean;
}

export type Cast = Map<string, Speaker>;

export interface HandleMark {
  tone: Tone;
  tip: string;
  speaker?: Speaker;
}

export interface Segment {
  text: string;
  tone?: Tone;
  tip?: string;
}

export interface ToneRange {
  start: number;
  end: number;
  tone: Tone;
}

interface Face {
  key: string;
  title: string;
  role?: Role;
  agent?: AgentFace;
  isKilled: boolean;
  isMember: boolean;
}

const YOU: Speaker = { key: "YOU", kind: "you", name: "You", work: "", isMember: false, isKilled: false };
const KEY = /^[0-9a-f]{8}$/;

// The slug after an SL or IC role names the workstream, so what the agent works on starts after it.
const workOf = (title: string, slug: string): string => {
  const parsed = Titles.parse(title);
  if (!parsed) return title;
  const { role, words, rest } = parsed;
  const after = role ? words.slice(words.indexOf(role) + 1) : words;
  const [first = ""] = after;
  const isSlug = first.toLowerCase() === slug.toLowerCase() || (!!role && role !== "DL" && first.includes("-"));
  return (isSlug ? after.slice(1) : after).join(" ") || rest;
};

const speakerOf = ({ key, title, role, agent, isKilled, isMember }: Face, slug: string): Speaker => {
  const work = workOf(title, slug);
  const kind = role === "EA" ? "assistant" : "agent";
  const token = Titles.parse(title)?.token;
  return {
    key,
    kind,
    work,
    isKilled,
    isMember,
    name: agent?.name ?? (kind === "assistant" ? "Assistant" : work || key),
    ...(role ? { role } : {}),
    ...(agent ? { face: agent } : {}),
    ...(token ? { token } : {}),
  };
};

const castOf = (channel: Channel, sessions: LiveSession[]): Cast => {
  const cast: Cast = new Map([[YOU.key, YOU]]);
  for (const { key, name = "", agent, life } of sessions) {
    const role = Titles.parse(name)?.role;
    const face = { key, title: name, isKilled: life === "killed", isMember: false };
    cast.set(key, speakerOf({ ...face, ...(role ? { role } : {}), ...(agent ? { agent } : {}) }, channel.slug));
  }
  for (const { key, title, role, agent, life } of channel.members) {
    const face = { key, title, role, isKilled: life === "killed", isMember: true };
    cast.set(key, speakerOf({ ...face, ...(agent ? { agent } : {}) }, channel.slug));
  }
  return cast;
};

const speaker = (cast: Cast, key: string): Speaker =>
  cast.get(key) ?? { key, kind: "agent", name: key, work: "", isMember: false, isKilled: false };

const byName = (a: Speaker, b: Speaker): number =>
  Number(a.isKilled) - Number(b.isKilled) || a.name.localeCompare(b.name);

const tipOf = ({ name, work, isKilled }: Speaker): string =>
  [name, work, isKilled ? "killed" : ""].filter(Boolean).join(" · ");

const namesOf = (cast: Cast, keys: string[]): string => andList(keys.map((key) => speaker(cast, key).name));

// The server resolves a handle in this order too: a key, else a member's name, else one name outside the channel.
const markOf = (word: string, cast: Cast): HandleMark | undefined => {
  const lower = word.toLowerCase();
  if (lower === "all") return { tone: "all", tip: "Everyone in the channel" };
  if (lower === "boss") return { tone: "boss", tip: "Raises it to you" };
  const named = [...cast.values()].filter((one) => one !== YOU && one.name.toLowerCase() === lower);
  const inside = named.find((one) => one.isMember);
  const hit = KEY.test(lower) ? cast.get(lower) : (inside ?? (named.length === 1 ? named[0] : undefined));
  return hit && { tone: hit.isMember ? "agent" : "out", tip: tipOf(hit), speaker: hit };
};

const segmentsOf = (text: string, cast: Cast): Segment[] => {
  const out: Segment[] = [];
  let at = 0;
  for (const { start, end, word } of Handles.of(text)) {
    const mark = markOf(word, cast);
    if (!mark) continue;
    if (start > at) out.push({ text: text.slice(at, start) });
    const label = mark.speaker && KEY.test(word) ? `@${mark.speaker.name}` : text.slice(start, end);
    out.push({ text: label, tone: mark.tone, tip: mark.tip });
    at = end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
};

const tonesOf = (text: string, cast: Cast): ToneRange[] =>
  Handles.of(text).flatMap(({ start, end, word }) => {
    const mark = markOf(word, cast);
    return mark ? [{ start, end, tone: mark.tone }] : [];
  });

export const ChannelCast = { byName, castOf, markOf, namesOf, segmentsOf, speaker, tipOf, tonesOf, you: YOU };
