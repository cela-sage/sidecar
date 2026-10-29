import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import z from "zod";
import { readTextSafe } from "../../../lib/files.ts";
import * as Events from "../../../lib/sidecar/events.ts";
import { Sidecar } from "../../../lib/sidecar/paths.ts";

const Stored = z.record(z.string(), z.number());

const file = (): string => join(Sidecar.home(), "seen.json");

const snapshot = (): Record<string, number> => {
  try {
    return Stored.parse(JSON.parse(readTextSafe(file()) ?? "{}"));
  } catch {
    return {};
  }
};

const save = (next: Record<string, number>): void => {
  mkdirSync(dirname(file()), { recursive: true });
  writeFileSync(file(), `${JSON.stringify(next, undefined, 2)}\n`);
};

const publish = (key: string, endedAt?: number): void =>
  Events.publish({ topic: "conversation.unseen", key, data: { key, ...(endedAt ? { endedAt } : {}) } });

const ended = (key: string, at = Date.now()): void => {
  save({ ...snapshot(), [key]: at });
  publish(key, at);
};

// A look clears the turn it saw and no newer one, so a click that races a turn ending leaves its dot.
const see = (key: string, endedAt: number): void => {
  const { [key]: stored, ...rest } = snapshot();
  if (!stored || stored > endedAt) return;
  save(rest);
  publish(key);
};

export const Seen = { ended, see, snapshot };
