import { Refusal } from "../../../lib/sidecar/refusal.ts";
import type { Killed, Resumed } from "../../../shared/types/channel.ts";
import { Lifecycle } from "../sessions/lifecycle.ts";
import { TaskLane } from "../tasks/lane.ts";
import { ChannelStore } from "./store.ts";
import { ChannelSync } from "./sync.ts";

export interface KillInput {
  given: string;
  by: string;
}

export interface ResumeInput extends KillInput {
  keys: string[];
}

// Only the workstream's own Individual Contributors, never its Domain Lead, its Solution Lead or the Assistant.
const kill = async ({ given, by }: KillInput): Promise<Killed> => {
  const { file, sessions } = ChannelSync.sync(given);
  const keys = TaskLane.leadsOf(sessions, file.slug)
    .filter((one) => one.life === "alive")
    .map((one) => one.key);
  if (!keys.length) throw new Refusal(`no Individual Contributor of ${file.slug} is alive`, 2);
  const { done, refused } = await ChannelSync.settled(keys, Lifecycle.kill, (killed) =>
    ChannelStore.append(file.slug, { kind: "kill", keys: killed, by }),
  );
  ChannelSync.changed(file.slug);
  return { killed: done, refused };
};

const resume = async ({ given, by, keys }: ResumeInput): Promise<Resumed> => {
  const { file, sessions } = ChannelSync.sync(given);
  const crew = new Map(TaskLane.leadsOf(sessions, file.slug).map((one) => [one.key, one]));
  const asked = [...new Set(keys)];
  if (!asked.length) throw new Refusal("resume needs the keys the kill took", 2);
  const able = asked.filter((key) => crew.get(key)?.life === "killed");
  const unable = asked
    .filter((key) => !able.includes(key))
    .map((key) => ({
      key,
      reason: crew.has(key) ? "already running" : `not an Individual Contributor of ${file.slug}`,
    }));
  const { done, refused } = await ChannelSync.settled(able, Lifecycle.resume, (resumed) =>
    ChannelStore.append(file.slug, { kind: "resume", keys: resumed, by }),
  );
  ChannelSync.changed(file.slug);
  return { resumed: done, refused: [...unable, ...refused] };
};

export const Crew = { kill, resume };
