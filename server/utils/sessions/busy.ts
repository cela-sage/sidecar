import * as Events from "../../../lib/sidecar/events.ts";
import { BusyRules, type Busy, type BusyTurn } from "../../../shared/utils/busy.ts";
import { Seen } from "./seen.ts";

const states = new Map<string, Busy>();
const quiet = new Map<string, ReturnType<typeof setTimeout>>();

const set = (key: string, now: Busy): void => {
  const was = states.get(key) ?? BusyRules.IDLE;
  if (BusyRules.same(was, now)) return;
  if (now.doing || now.asking) states.set(key, now);
  else states.delete(key);
  // Before the change goes out, so the working mark gives way to the dot and never to a check in between.
  if (was.doing && !now.doing) Seen.ended(key);
  Events.publish({ topic: "conversation.changed", key, data: { key, ...now } });
};

const heard = (key: string, turns: BusyTurn[]): void => {
  clearTimeout(quiet.get(key));
  let now = states.get(key) ?? BusyRules.IDLE;
  let arm = false;
  for (const turn of turns) ({ now, quiet: arm } = BusyRules.next(now, turn));
  set(key, now);
  if (arm)
    quiet.set(
      key,
      setTimeout(() => set(key, BusyRules.IDLE), BusyRules.QUIET_MS),
    );
};

const ask = (key: string, isAsking: boolean): void => {
  const was = states.get(key) ?? BusyRules.IDLE;
  set(key, { doing: was.doing || isAsking, asking: isAsking });
};

const snapshot = (): Record<string, Busy> => Object.fromEntries(states);

export const TurnBus = { ask, heard, snapshot };
