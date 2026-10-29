import type { EventStream } from "h3";
import * as Events from "../../lib/sidecar/events.ts";
import type { TerminalState } from "../../shared/types/events.ts";
import { TaskCaller } from "./tasks/caller.ts";

const followers: EventStream[] = [];
let state: TerminalState = { following: false };

const set = (next: TerminalState): TerminalState => {
  state = next;
  Events.publish({ topic: "terminal.changed", data: state, key: "" });
  return state;
};

const join = (stream: EventStream): (() => void) => {
  followers.push(stream);
  set({ ...state, following: true });
  return () => {
    followers.splice(followers.indexOf(stream), 1);
    set(followers.length ? state : { following: false });
  };
};

const attach = (key: string): boolean => {
  const follower = followers.at(-1);
  if (!follower) return false;
  void follower.push({ event: "attach", data: JSON.stringify({ key }) });
  return true;
};

const release = (key: string): void => {
  if (state.held?.key !== key) return;
  for (const follower of followers) void follower.push({ event: "release", data: JSON.stringify({ key }) });
};

const hold = (key?: string): TerminalState => {
  const name = key ? TaskCaller.titleByKey(key) : undefined;
  return set({ following: followers.length > 0, ...(key ? { held: { key, ...(name ? { name } : {}) } } : {}) });
};

export const Terminal = { attach, hold, join, release, state: (): TerminalState => state };
