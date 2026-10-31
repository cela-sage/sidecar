import type { Channel } from "~~/shared/types/channel";
import { Handles } from "../../shared/utils/handles.ts";
import { Titles } from "../../shared/utils/titles.ts";
import { ChannelCast, type Cast, type Speaker } from "./channel-cast.ts";
import { andList } from "./label.ts";

export interface ChannelPick {
  key: string;
  handle: string;
  section: "in" | "out";
  speaker?: Speaker;
  name: string;
  work: string;
  note: string;
  isUrgent: boolean;
}

export interface OfferInput {
  channel: Channel;
  cast: Cast;
  query: string;
  busy: Set<string>;
}

const OUTSIDE_MAX = 6;
const WORD = /^[\p{L}\p{N}_-]+$/u;
const QUIET = "no @ · notifies no one";

const homeOf = (channel: Channel): string | undefined =>
  channel.members.map((one) => Titles.parse(one.title)?.token).find(Boolean);

const raisersOf = (channel: Channel): Set<string> => {
  const raised = new Set(channel.raised);
  const posts = [
    ...channel.lines.flatMap((one) => (one.kind === "post" ? [one] : [])),
    ...Object.values(channel.threads).flat(),
  ];
  return new Set(posts.filter((one) => raised.has(one.id)).map((one) => one.by));
};

// A member's name wins on the server, so only an outside name that someone else shares goes in as the key.
const handleOf = (one: Speaker, cast: Cast): string => {
  const lower = one.name.toLowerCase();
  const rivals = [...cast.values()].filter(
    (other) => other.key !== one.key && other.kind !== "you" && (!one.isMember || other.isMember),
  );
  const isClear = WORD.test(one.name) && !rivals.some((other) => other.name.toLowerCase() === lower);
  return isClear ? `@${one.name}` : `@${one.key}`;
};

const offer = ({ channel, cast, query, busy }: OfferInput): ChannelPick[] => {
  const needle = query.toLowerCase();
  const fits = (one: Speaker): boolean => one.name.toLowerCase().includes(needle);
  const raisers = raisersOf(channel);
  const alive = channel.members
    .map((one) => ChannelCast.speaker(cast, one.key))
    .filter((one) => !one.isKilled)
    .sort(ChannelCast.byName);
  const inside = alive.filter(fits).map(
    (one): ChannelPick => ({
      key: one.key,
      handle: handleOf(one, cast),
      section: "in",
      speaker: one,
      name: one.name,
      work: one.work,
      note: raisers.has(one.key) ? "waits on you" : busy.has(one.key) ? "working" : "idle",
      isUrgent: raisers.has(one.key),
    }),
  );
  const everyone: ChannelPick = {
    key: "all",
    handle: "@all",
    section: "in",
    name: "@all",
    work: "everyone in the channel",
    note: `notifies ${alive.length}`,
    isUrgent: false,
  };
  const home = homeOf(channel);
  const outside = [...cast.values()]
    .filter((one) => !one.isMember && one.kind === "agent" && !!one.face && !one.isKilled && fits(one))
    .sort(ChannelCast.byName)
    .slice(0, OUTSIDE_MAX)
    .map(
      (one): ChannelPick => ({
        key: one.key,
        handle: handleOf(one, cast),
        section: "out",
        speaker: one,
        name: one.name,
        work: one.token && one.token !== home ? `${one.work} · ${one.token}` : one.work,
        note: "one read",
        isUrgent: false,
      }),
    );
  return [...inside, ...(alive.length && "all".startsWith(needle) ? [everyone] : []), ...outside];
};

const reachOf = (text: string, cast: Cast): string => {
  const marks = Handles.of(text).flatMap(({ word }) => ChannelCast.markOf(word, cast) ?? []);
  const names = (inside: boolean): string[] => [
    ...new Set(marks.flatMap(({ speaker }) => (speaker && speaker.isMember === inside ? [speaker.name] : []))),
  ];
  const members = names(true);
  const outside = names(false);
  const notified = marks.some((one) => one.tone === "all")
    ? "notifies everyone"
    : members.length
      ? `notifies ${andList(members)}`
      : "";
  const read = outside.length ? `${andList(outside)} ${outside.length === 1 ? "gets" : "get"} one read` : "";
  return [notified, read].filter(Boolean).join(" · ") || QUIET;
};

export const ChannelPicker = { offer, quiet: QUIET, reachOf };
