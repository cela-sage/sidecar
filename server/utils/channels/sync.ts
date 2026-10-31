import * as Events from "../../../lib/sidecar/events.ts";
import type { Refused } from "../../../shared/types/channel.ts";
import type { Life, LiveSession } from "../../../shared/types/session.ts";
import { Workstreams } from "../../../shared/utils/workstream.ts";
import { Projects } from "../projects.ts";
import { liveSessions } from "../sessions/index.ts";
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
  return Members.derive({ sessions, slug: file.slug, token })
    .filter(({ session }) => !folded.joined.has(session.key))
    .sort(
      (a, b) => (a.session.startedAt ?? 0) - (b.session.startedAt ?? 0) || Members.rank(a.role) - Members.rank(b.role),
    )
    .map(({ session, role }) => ({
      kind: "join" as const,
      key: session.key,
      title: session.name ?? session.key,
      role,
      ...(session.life === "killed" ? { killed: true as const } : {}),
      ...(session.startedAt && session.startedAt > since ? { at: new Date(session.startedAt).toISOString() } : {}),
    }));
};

const missing = (synced: Synced): NewEntry[] => {
  const { file, folded, sessions } = synced;
  const now = new Map(sessions.map((one) => [one.key, one.life]));
  const moved = (from: Life): string[] =>
    [...folded.joined.keys()].filter(
      (key) => !settling.has(key) && folded.life.get(key) === from && (now.get(key) ?? "killed") !== from,
    );
  const [killed, resumed] = [moved("alive"), moved("killed")];
  const archived = Workstreams.isArchived(file.task);
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

// The channel catches up on what the titles, the processes and the task say each time it is read or posted to.
const sync = (given: string): Synced => {
  const file = TaskFiles.open(given);
  const sessions = liveSessions();
  const folded = refold(file.slug);
  const lines = missing({ file, folded, sessions });
  if (!lines.length) return { file, folded, sessions };
  for (const one of lines) ChannelStore.append(file.slug, one);
  const caught = refold(file.slug);
  changed(file.slug, caught);
  return { file, folded: caught, sessions };
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
