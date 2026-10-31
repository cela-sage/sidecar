import * as Events from "../../../lib/sidecar/events.ts";
import { Refusal } from "../../../lib/sidecar/refusal.ts";
import type { Channel, ChannelLine, ChannelMember, ChannelPost } from "../../../shared/types/channel.ts";
import type { LiveSession } from "../../../shared/types/session.ts";
import { Titles } from "../../../shared/utils/titles.ts";
import { Workstreams } from "../../../shared/utils/workstream.ts";
import { deliver } from "../sessions/inbox.ts";
import { TaskFiles } from "../tasks/file.ts";
import { Crew } from "./crew.ts";
import { ChannelFold, type Folded } from "./fold.ts";
import { Members } from "./members.ts";
import { Reach, type Author, type NoteKind, type Speaker } from "./reach.ts";
import { ChannelStore } from "./store.ts";
import { ChannelSync, type Synced } from "./sync.ts";

export interface PostInput {
  given: string;
  author: Author;
  text: string;
  thread?: string;
  broadcast?: boolean;
}

export interface TakeInput {
  given: string;
  reader: Author;
  upto?: string;
  fresh?: boolean;
}

export interface Taken {
  slug: string;
  title: string;
  archived: boolean;
  members: ChannelMember[];
  lines: ChannelLine[];
}

const read = (given: string): Channel => {
  const { file, folded, sessions } = ChannelSync.sync(given);
  return ChannelFold.view({ slug: file.slug, title: file.title, folded, members: Members.of(folded, sessions) });
};

const rootOf = (folded: Folded, thread: string): ChannelPost => {
  const hit = folded.posts.get(thread);
  if (!hit) throw new Refusal(`no post ${thread} in this channel`, 2);
  return hit.thread ? (folded.posts.get(hit.thread) ?? hit) : hit;
};

const raisedIn = (folded: Folded, thread: string): string[] => [
  ...new Set(
    [...folded.posts.values()]
      .filter((one) => (one.id === thread || one.thread === thread) && one.reach.boss && !one.answered)
      .map((one) => one.by),
  ),
];

const speakerOf = (by: string, members: ChannelMember[], sessions: LiveSession[]): Speaker => {
  const member = members.find((one) => one.key === by);
  const session = sessions.find((one) => one.key === by);
  const role = member?.role ?? (session?.name ? Titles.parse(session.name)?.role : undefined);
  const name = (member?.agent ?? session?.agent)?.name;
  return { by, ...(role ? { role } : {}), ...(name ? { name } : {}) };
};

// A mention wakes an alive agent whose process is down but never a killed one; Marco's @boss answer wakes either.
const post = async ({ given, author, text, thread, broadcast = false }: PostInput): Promise<ChannelPost> => {
  const { file, folded, sessions } = ChannelSync.sync(given);
  if (broadcast && !thread) throw new Refusal("a reply goes to the channel too only from its thread: add --thread <id>", 2);
  const root = thread ? rootOf(folded, thread) : undefined;
  const members = Members.of(folded, sessions);
  const known = new Set(sessions.map((one) => one.key));
  const mentions = Reach.aim({
    slug: file.slug,
    author,
    text,
    members,
    everyone: sessions.flatMap(({ key, agent }) => (agent ? [{ key, name: agent.name }] : [])),
    root,
    archived: folded.archived,
    isConversation: (key) => known.has(key),
  });
  const said = text.trim();
  const saved = ChannelStore.append(file.slug, {
    kind: "post",
    by: author.by,
    text: said,
    ...(root ? { thread: root.id } : {}),
    ...(root && broadcast ? { broadcast: true as const } : {}),
    mentions,
  });
  const answered = author.who === "YOU" && root ? raisedIn(folded, root.id) : [];
  const notes = new Map<string, NoteKind>([
    ...mentions.keys.map((key): [string, NoteKind] => [key, "member"]),
    ...mentions.outside.map((key): [string, NoteKind] => [key, "outside"]),
    ...answered.map((key): [string, NoteKind] => [key, "answer"]),
  ]);
  const asker = speakerOf(author.by, members, sessions);
  const speaker = Reach.speakerOf(asker);
  const handle = author.who === "YOU" || author.who === "EA" ? undefined : (asker.name ?? author.by);
  const from = author.by === "YOU" ? undefined : author.by;
  const lives = new Map(sessions.map((one) => [one.key, one.life]));
  const results = await Promise.all(
    [...notes].map(async ([key, kind]) => {
      const note = Reach.note({
        kind,
        slug: file.slug,
        speaker,
        ...(handle ? { handle } : {}),
        text: said,
        post: saved.id,
        thread: root?.id ?? saved.id,
      });
      const sent = await deliver({
        key,
        text: note,
        slug: file.slug,
        from,
        isRelay: false,
        canWake: kind === "answer" || lives.get(key) === "alive",
      });
      return { key, delivered: sent.delivered };
    }),
  );
  if (results.length)
    ChannelStore.append(file.slug, {
      kind: "reach",
      post: saved.id,
      notified: results.filter((one) => one.delivered).map((one) => one.key),
      missed: results.filter((one) => !one.delivered).map((one) => one.key),
    });
  const after = ChannelSync.refold(file.slug);
  ChannelSync.changed(file.slug, after);
  if (mentions.boss)
    Events.publish({
      topic: "channel.raised",
      data: { slug: file.slug, title: file.title, post: saved.id, from: author.by, text: said },
    });
  const posted = after.posts.get(saved.id);
  if (!posted) throw new Error(`post ${saved.id} did not land in #${file.slug}`);
  return posted;
};

const outsideRead = ({ file, folded }: Synced, { reader, upto }: TakeInput): ChannelLine[] => {
  const token = upto ? folded.posts.get(upto)?.reach.outside.find((one) => one.key === reader.by) : undefined;
  if (!upto || !token)
    throw new Refusal(`you are not in #${file.slug}, so you read it only from a message that mentions you`, 2);
  const spent = token.read && new Date(token.read).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  if (spent) throw new Refusal(`you spent your one read of #${file.slug} on ${spent}`, 2);
  ChannelStore.append(file.slug, { kind: "read", key: reader.by, upto, post: upto });
  return folded.lines.slice(0, folded.lines.findIndex((one) => one.id === upto) + 1);
};

const memberRead = ({ file, folded }: Synced, { reader, upto, fresh }: TakeInput): ChannelLine[] => {
  const end = upto ? folded.lines.findIndex((one) => one.id === upto) : folded.lines.length - 1;
  if (upto && end < 0) throw new Refusal(`no line ${upto} in #${file.slug}`, 2);
  const cursor = folded.reads.get(reader.by);
  const start = fresh ? folded.lines.findIndex((one) => one.id === cursor) + 1 : 0;
  const last = folded.lines.at(-1);
  if (!upto && last && cursor !== last.id)
    ChannelStore.append(file.slug, { kind: "read", key: reader.by, upto: last.id });
  return folded.lines.slice(start, end + 1);
};

const take = (input: TakeInput): Taken => {
  const synced = ChannelSync.sync(input.given);
  const { file, folded, sessions } = synced;
  const members = Members.of(folded, sessions);
  const { who, by } = input.reader;
  const isInside = who === "YOU" || who === "EA" || members.some((one) => one.key === by);
  const lines = isInside ? memberRead(synced, input) : outsideRead(synced, input);
  return { slug: file.slug, title: file.title, archived: folded.archived, members, lines };
};

const summary = (): Record<string, { raised: number }> => {
  const archived = new Set(
    TaskFiles.all()
      .filter((one) => Workstreams.isArchived(one.task.state))
      .map((one) => one.slug),
  );
  return Object.fromEntries(
    ChannelStore.slugs().map((slug) => [
      slug,
      { raised: archived.has(slug) ? 0 : ChannelFold.raisedOf(ChannelSync.refold(slug)).length },
    ]),
  );
};

export const Channels = { kill: Crew.kill, post, read, resume: Crew.resume, summary, take };
