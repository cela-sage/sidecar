import type { ChannelLine, ChannelMember, ChannelPost } from "../shared/types/channel.ts";
import type { AgentFace } from "../shared/types/session.ts";
import { Channels } from "../server/utils/channels/index.ts";
import type { Author } from "../server/utils/channels/reach.ts";
import { Faces } from "../server/utils/sessions/faces.ts";
import { TaskCaller } from "../server/utils/tasks/caller.ts";
import { TaskNotice } from "../server/utils/tasks/notice.ts";
import { clock } from "./clock.ts";

export interface ChannelRun {
  slug: string;
  words: string[];
  values: { thread?: string; upto?: string; new?: boolean; json?: boolean; broadcast?: boolean };
  address: string;
}

type Line<K extends ChannelLine["kind"]> = Extract<ChannelLine, { kind: K }>;

const authorOf = (): Author => {
  const { who, key } = TaskCaller.of(process.env.CLAUDE_CODE_SESSION_ID);
  return { by: who === "YOU" || !key ? "YOU" : key, who };
};

const reached = ({ id, reach }: ChannelPost, slug: string): string => {
  const faces = Faces.all();
  const names = (list: string[]): string => list.map((key) => faces.get(key)?.name ?? `\`${key}\``).join(", ");
  const said = [
    ...(reach.notified.length ? [`notified ${names(reach.notified)}`] : []),
    ...(reach.missed.length ? [`could not reach ${names(reach.missed)}, which is killed`] : []),
    ...(reach.outside.length
      ? [`${names(reach.outside.map((one) => one.key))} outside the channel gets one read`]
      : []),
    ...(reach.boss ? ["raised it to Marco, who answers in its thread"] : []),
  ];
  return `posted ${id} in #${slug}, ${said.length ? said.join("; ") : "and it notified no one, since it has no @"}`;
};

const post = async ({ slug, words, values, address }: ChannelRun): Promise<number> => {
  const posted = await Channels.post({
    given: slug,
    author: authorOf(),
    text: words.join(" "),
    ...(values.thread ? { thread: values.thread } : {}),
    ...(values.broadcast ? { broadcast: true } : {}),
  });
  if (posted.reach.boss)
    await TaskNotice.raise({
      address,
      notice: { title: `#${slug}`, subtitle: "@boss: it needs you", text: posted.text },
    });
  console.log(reached(posted, slug));
  return 0;
};

const LINES: { [K in ChannelLine["kind"]]: (line: Line<K>, who: (key: string) => string) => string } = {
  post: ({ id, by, text, thread, broadcast, reach, answered }, who) => {
    const raised = reach.boss ? (answered ? "  (@boss, answered)" : "  (@boss, waits on Marco)") : "";
    const loud = broadcast ? "  (also sent to the channel)" : "";
    return `${thread ? "  ↳ " : ""}${id}  ${who(by)}: ${text}${raised}${loud}`;
  },
  join: ({ key, by }, who) => `·  ${who(key)} joined${by ? `, spawned by ${who(by)}` : ""}`,
  kill: ({ keys: killed, by }, who) => `·  ${killed.map(who).join(", ")} killed${by ? ` by ${who(by)}` : ""}`,
  resume: ({ keys: back, by }, who) => `·  ${back.map(who).join(", ")} back${by ? `, resumed by ${who(by)}` : ""}`,
  archive: ({ by }, who) => `·  archived${by ? ` by ${who(by)}` : ""}, so the channel is read only`,
  restore: ({ by }, who) => `·  restored${by ? ` by ${who(by)}` : ""}`,
};

const lineOf = <K extends ChannelLine["kind"]>(kind: K, line: Line<K>, who: (key: string) => string): string =>
  `  ${clock(line.at).padEnd(13)} ${LINES[kind](line, who)}`;

const whoOf =
  (members: ChannelMember[], faces: Map<string, AgentFace>) =>
  (key: string): string => {
    if (key === "YOU") return "Marco";
    const role = members.find((one) => one.key === key)?.role;
    if (role === "EA") return "the Assistant";
    return [faces.get(key)?.name ?? key, role].filter(Boolean).join(" ");
  };

const channel = async ({ slug, values }: ChannelRun): Promise<number> => {
  const taken = Channels.take({
    given: slug,
    reader: authorOf(),
    ...(values.upto ? { upto: values.upto } : {}),
    ...(values.new ? { fresh: true } : {}),
  });
  if (values.json) {
    console.log(JSON.stringify(taken, null, 2));
    return 0;
  }
  const who = whoOf(taken.members, Faces.all());
  const crew = taken.members.map(
    ({ key, role, life, agent }) => `${agent?.name ?? key} ${role} ${key}${life === "killed" ? " (killed)" : ""}`,
  );
  console.log(
    [
      `#${taken.slug}  ${taken.title}${taken.archived ? "  archived, read only" : ""}`,
      `Members: ${crew.join(", ") || "none yet"}`,
      "",
      ...(taken.lines.length
        ? taken.lines.map((one) => lineOf(one.kind, one, who))
        : [values.new ? "Nothing new." : "Nothing said yet."]),
      "",
      `Answer in a thread with: sidecar task ${taken.slug} post "<text>" --thread <id>`,
    ].join("\n"),
  );
  return 0;
};

export const ChannelVerbs = { channel, post };
