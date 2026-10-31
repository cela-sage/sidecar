import * as Events from "../../../lib/sidecar/events.ts";
import type { Refused } from "../../../shared/types/channel.ts";
import type { SidecarEvent } from "../../../shared/types/events.ts";
import type { Life, LiveSession } from "../../../shared/types/session.ts";
import { Titles } from "../../../shared/utils/titles.ts";
import { Workstreams } from "../../../shared/utils/workstream.ts";
import { Projects } from "../projects.ts";
import { Faces } from "../sessions/faces.ts";
import { liveSessions } from "../sessions/index.ts";
import { Spawns } from "../sessions/spawns.ts";
import { TaskCaller } from "../tasks/caller.ts";
import { TaskFiles, type TaskFile } from "../tasks/file.ts";
import { TaskHistory } from "../tasks/history.ts";
import { ChannelFold, type Folded } from "./fold.ts";
import { Members } from "./members.ts";
import { ChannelStore, type NewEntry } from "./store.ts";

export interface Synced {
  file: TaskFile;
  folded: Folded;
  sessions: LiveSession[];
}

export interface Settled {
  done: string[];
  refused: Refused[];
}

interface RelaysInput {
  folded: Folded;
  joining: NewEntry[];
  events: SidecarEvent[];
}

// A kill or resume in flight writes its own line, so a read meanwhile must not write one for the same keys.
const settling = new Set<string>();

const refold = (slug: string): Folded => ChannelFold.fold(ChannelStore.read(slug));

const changed = (slug: string, folded: Folded = refold(slug)): void =>
  Events.publish({ topic: "channel.changed", data: { slug, raised: ChannelFold.raisedOf(folded).length } });

const moverOf = (slug: string): string | undefined => {
  const last = TaskHistory.read(slug).findLast((entry) => entry.kind === "state");
  if (last?.who === "YOU") return "YOU";
  return last?.from ? TaskCaller.keyByTitle(last.from) : undefined;
};

const joinsOf = ({ file, folded, sessions }: Synced): NewEntry[] => {
  const since = Date.parse(folded.lines.at(-1)?.at ?? "") || 0;
  const token = Projects.find(file.task.project)?.token;
  const fresh = Members.derive({ sessions, slug: file.slug, token }).filter(
    ({ session }) => !folded.joined.has(session.key),
  );
  const spawners = fresh.length ? Spawns.spawners() : new Map<string, string>();
  return fresh
    .sort(
      (a, b) => (a.session.startedAt ?? 0) - (b.session.startedAt ?? 0) || Members.rank(a.role) - Members.rank(b.role),
    )
    .map(({ session, role }) => {
      const by = spawners.get(session.key);
      return {
        kind: "join" as const,
        key: session.key,
        title: session.name ?? session.key,
        role,
        ...(by ? { by } : {}),
        ...(session.life === "killed" ? { killed: true as const } : {}),
        ...(session.startedAt && session.startedAt > since ? { at: new Date(session.startedAt).toISOString() } : {}),
      };
    });
};

const missing = (synced: Synced): NewEntry[] => {
  const { file, folded, sessions } = synced;
  const now = new Map(sessions.map((one) => [one.key, one.life]));
  const moved = (from: Life): string[] =>
    [...folded.joined.keys()].filter(
      (key) => !settling.has(key) && folded.life.get(key) === from && (now.get(key) ?? "killed") !== from,
    );
  const [killed, resumed] = [moved("alive"), moved("killed")];
  const archived = Workstreams.isArchived(file.task.state);
  const mover = archived === folded.archived ? undefined : moverOf(file.slug);
  return [
    ...joinsOf(synced),
    ...(killed.length ? [{ kind: "kill" as const, keys: killed }] : []),
    ...(resumed.length ? [{ kind: "resume" as const, keys: resumed }] : []),
    ...(archived === folded.archived
      ? []
      : [{ kind: archived ? ("archive" as const) : ("restore" as const), ...(mover ? { by: mover } : {}) }]),
  ];
};

const relaysOf = ({ folded, joining, events }: RelaysInput): NewEntry[] => {
  const inside = new Set([...folded.joined.keys(), ...joining.flatMap((one) => (one.kind === "join" ? one.key : []))]);
  return events.flatMap((one) => {
    if (one.topic !== "relay.sent") return [];
    const { from, to, text } = one.data;
    const isKnown = folded.dms.has(`${one.at}|${from}|${to}`);
    return inside.has(from) && inside.has(to) && !isKnown ? [{ kind: "dm" as const, at: one.at, from, to, text }] : [];
  });
};

// The channel catches up on what the titles, the processes and the task say each time it is read or posted to.
const sync = (given: string): Synced => {
  const file = TaskFiles.open(given);
  const sessions = liveSessions();
  const folded = refold(file.slug);
  const since = ChannelStore.offset(file.slug);
  const log = Events.read(since);
  const joining = missing({ file, folded, sessions });
  const lines = [...joining, ...relaysOf({ folded, joining, events: log.events })];
  if (log.offset !== since) ChannelStore.advance(file.slug, log.offset);
  if (!lines.length) return { file, folded, sessions };
  for (const one of lines) {
    if (one.kind === "join") Faces.draw({ key: one.key, project: Titles.parse(one.title)?.token ?? "" });
    ChannelStore.append(file.slug, one);
  }
  const faces = Faces.all();
  const named = sessions.map((one) => {
    const agent = one.agent ?? faces.get(one.key);
    return agent ? { ...one, agent } : one;
  });
  const caught = refold(file.slug);
  changed(file.slug, caught);
  return { file, folded: caught, sessions: named };
};

const settled = async (
  keys: string[],
  act: (key: string) => Promise<unknown>,
  record: (done: string[]) => void,
): Promise<Settled> => {
  for (const key of keys) settling.add(key);
  const outcomes = await Promise.allSettled(keys.map(act));
  const done = keys.filter((_, i) => outcomes[i]?.status === "fulfilled");
  const refused = outcomes.flatMap((one, i) =>
    one.status === "rejected"
      ? [{ key: keys[i] ?? "", reason: one.reason instanceof Error ? one.reason.message : String(one.reason) }]
      : [],
  );
  if (done.length) record(done);
  for (const key of keys) settling.delete(key);
  return { done, refused };
};

export const ChannelSync = { changed, refold, settled, sync };
