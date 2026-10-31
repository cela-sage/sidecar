import * as Events from "../../../lib/sidecar/events.ts";

export interface Spawn {
  key: string;
  by: string;
}

// `relay --new` in Notes imports this file with a plain node import, so keep it free of Nitro's auto-imports.
const record = ({ key, by }: Spawn): void => Events.publish({ topic: "session.spawned", key, data: { key, by } });

const spawners = (): Map<string, string> => {
  const found = new Map<string, string>();
  for (const one of Events.read(0).events) {
    if (one.topic === "session.spawned" && !found.has(one.data.key)) found.set(one.data.key, one.data.by);
  }
  return found;
};

export const Spawns = { record, spawners };
