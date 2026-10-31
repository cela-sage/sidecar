import { join } from "node:path";
import { Refusal } from "../../../lib/sidecar/refusal.ts";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import type { ChannelMember, ChannelPost } from "../../../shared/types/channel.ts";
import type { Role, Who } from "../../../shared/types/task.ts";
import { isKey } from "../sessions/paths.ts";
import type { PostMentions } from "./store.ts";

export interface Author {
  by: string;
  who: Who;
}

export interface Named {
  key: string;
  name?: string;
}

export interface Roster {
  members: Named[];
  everyone: Named[];
}

export interface AimInput {
  slug: string;
  author: Author;
  text: string;
  members: ChannelMember[];
  everyone: Named[];
  root?: ChannelPost;
  archived: boolean;
  isConversation: (key: string) => boolean;
}

export interface Speaker {
  by: string;
  role?: Role;
  name?: string;
}

export interface Mentioned {
  keys: string[];
  all: boolean;
  boss: boolean;
  ambiguous: string[];
}

export type NoteKind = "member" | "outside" | "answer";

export interface NoteInput {
  kind: NoteKind;
  slug: string;
  speaker: string;
  text: string;
  post: string;
  thread: string;
}

const MENTION = /(?<![\p{L}\p{N}_@./-])@([\p{L}\p{N}_-]+)/gu;

// The one place a mention becomes conversations: a key, else a member's name, else a name outside the channel.
const resolve = (word: string, { members, everyone }: Roster): string[] => {
  const lower = word.toLowerCase();
  if (isKey(lower)) return [lower];
  const named = (list: Named[]): string[] =>
    list.filter((one) => one.name?.toLowerCase() === lower).map((one) => one.key);
  const inside = named(members);
  return inside.length ? inside : [...new Set(named(everyone))];
};

const mentioned = (text: string, roster: Roster): Mentioned => {
  const words = [...text.matchAll(MENTION)].map((hit) => hit[1] ?? "");
  const named = words
    .filter((word) => word !== "all" && word !== "boss")
    .map((word) => ({
      word,
      keys: resolve(word, roster),
    }));
  return {
    keys: [...new Set(named.flatMap(({ keys }) => (keys.length === 1 ? keys : [])))],
    all: words.includes("all"),
    boss: words.includes("boss"),
    ambiguous: named.filter(({ keys }) => keys.length > 1).map(({ word }) => word),
  };
};

const listed = (keys: string[]): string => keys.map((key) => `\`${key}\``).join(", ");

const isPrivileged = ({ who }: Author): boolean => who === "YOU" || who === "EA";

const aim = (input: AimInput): PostMentions => {
  const { slug, author, text, members, everyone, root, archived, isConversation } = input;
  if (archived) throw new Refusal(`#${slug} is archived, so its channel is read only`, 2);
  if (!text.trim()) throw new Refusal('post needs the message in quotes: post "<text>"', 2);
  const inside = new Set(members.map((one) => one.key));
  const isAsked = !!root?.reach.outside.some((one) => one.key === author.by);
  if (!isPrivileged(author) && !inside.has(author.by) && !isAsked)
    throw new Refusal(`you are not in #${slug}, so you cannot post there`, 2);
  const roster = { members: members.map(({ key, agent }) => ({ key, name: agent?.name })), everyone };
  const { keys, all, boss, ambiguous } = mentioned(text, roster);
  if (ambiguous.length)
    throw new Refusal(`@${ambiguous.join(", @")} names more than one conversation outside #${slug}, so @ its key`, 2);
  const others = keys.filter((key) => key !== author.by);
  const outside = others.filter((key) => !inside.has(key));
  if (outside.length && !isPrivileged(author))
    throw new Refusal(`${listed(outside)} not in #${slug}, and an agent can @ only the channel's members`, 2);
  const unknown = outside.filter((key) => !isConversation(key));
  if (unknown.length) throw new Refusal(`no conversation ${listed(unknown)}`, 2);
  const alive = all ? members.filter((one) => one.life === "alive" && one.key !== author.by).map((one) => one.key) : [];
  return {
    keys: [...new Set([...others.filter((key) => inside.has(key)), ...alive])],
    outside,
    ...(all ? { all: true as const } : {}),
    ...(boss && author.who !== "YOU" ? { boss: true as const } : {}),
  };
};

const speakerOf = ({ by, role, name }: Speaker): string => {
  if (by === "YOU") return "Marco";
  if (role === "EA") return "the Assistant";
  const who = name ? `${name} \`${by}\`` : `\`${by}\``;
  return role ? `${who} (${role})` : who;
};

const cli = (): string => join(Sidecar.root(), "bin", "sidecar");

const OPENERS: Record<NoteKind, (input: NoteInput) => string> = {
  member: ({ speaker, slug }) => `${speaker} in #${slug}:`,
  outside: ({ speaker, slug }) => `${speaker} mentioned you in #${slug}, a channel you are not in:`,
  answer: ({ slug }) => `Marco answered your @boss in #${slug}:`,
};

const note = (input: NoteInput): string => {
  const { kind, slug, text, post, thread } = input;
  const reply = `Answer in its thread: \`${cli()} task ${slug} post "<reply>" --thread ${thread}\``;
  const read =
    kind === "outside"
      ? `You get one read of the channel up to this message: \`${cli()} task ${slug} channel --upto ${post}\``
      : `Read what is new in the channel: \`${cli()} task ${slug} channel --new\``;
  return `${OPENERS[kind](input)} ${text}\n\n${reply}\n${read}`;
};

export const Reach = { aim, mentioned, note, resolve, speakerOf };
