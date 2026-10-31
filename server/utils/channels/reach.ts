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

export interface AimInput {
  slug: string;
  author: Author;
  text: string;
  members: ChannelMember[];
  root?: ChannelPost;
  archived: boolean;
  isConversation: (key: string) => boolean;
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

const MENTION = /(?<![\w@./-])@([\w-]+)/g;

// Names plug in here: until the agents have them, a mention is a conversation's 8-hex key.
const resolve = (word: string): string | undefined => (isKey(word.toLowerCase()) ? word.toLowerCase() : undefined);

const mentioned = (text: string): { keys: string[]; all: boolean; boss: boolean } => {
  const words = [...text.matchAll(MENTION)].map((hit) => hit[1] ?? "");
  const keys = words.flatMap((word) => resolve(word) ?? []);
  return { keys: [...new Set(keys)], all: words.includes("all"), boss: words.includes("boss") };
};

const listed = (keys: string[]): string => keys.map((key) => `\`${key}\``).join(", ");

const isPrivileged = ({ who }: Author): boolean => who === "YOU" || who === "EA";

const aim = ({ slug, author, text, members, root, archived, isConversation }: AimInput): PostMentions => {
  if (archived) throw new Refusal(`#${slug} is archived, so its channel is read only`, 2);
  if (!text.trim()) throw new Refusal('post needs the message in quotes: post "<text>"', 2);
  const inside = new Set(members.map((one) => one.key));
  const isAsked = !!root?.reach.outside.some((one) => one.key === author.by);
  if (!isPrivileged(author) && !inside.has(author.by) && !isAsked)
    throw new Refusal(`you are not in #${slug}, so you cannot post there`, 2);
  const { keys, all, boss } = mentioned(text);
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

const speakerOf = (by: string, role?: Role): string => {
  if (by === "YOU") return "Marco";
  if (role === "EA") return "the Assistant";
  return role ? `\`${by}\` (${role})` : `\`${by}\``;
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
