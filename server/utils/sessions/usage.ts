import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import z from "zod";
import { readTextSafe } from "../../../lib/files.ts";
import * as Events from "../../../lib/sidecar/events.ts";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import type { RateLimit, SessionUsage } from "../../../shared/types/usage.ts";
import { deliver } from "./inbox.ts";

const Reading = z.object({
  context: z.object({
    window: z.number().positive(),
    tokens: z.number().min(0).optional(),
    percent: z.number().min(0).optional(),
  }),
  rateLimits: z.array(
    z.object({ kind: z.string().min(1), percentUsed: z.number().min(0), resetsAt: z.string().optional() }),
  ),
  isCompacting: z.literal(true).optional(),
  breakdown: z
    .object({
      model: z.string(),
      parts: z.array(z.object({ label: z.string().min(1), tokens: z.number().min(0) })),
      autoCompactPercent: z.number().min(0).optional(),
    })
    .optional(),
}) satisfies z.ZodType<SessionUsage>;

const Held = z.object({ at: z.number(), usage: Reading });
type Held = z.infer<typeof Held>;

const directory = (): string => join(Sidecar.home(), "usage");
const fileOf = (key: string): string => join(directory(), `${key}.json`);

const read = (file: string): Held | undefined => {
  try {
    return Held.parse(JSON.parse(readTextSafe(file) ?? ""));
  } catch {
    return undefined;
  }
};

const everyHeld = (): Held[] => {
  try {
    return readdirSync(directory()).flatMap((name) => read(join(directory(), name)) ?? []);
  } catch {
    return [];
  }
};

const held = (key: string): SessionUsage | undefined => read(fileOf(key))?.usage;

const answer = (key: string, usage: SessionUsage): void => {
  const isChanged = !isDeepStrictEqual(held(key), usage);
  mkdirSync(directory(), { recursive: true });
  writeFileSync(fileOf(key), JSON.stringify({ at: Date.now(), usage }));
  if (isChanged) Events.publish({ topic: "usage.changed", key, data: { key } });
};

// The limits are the account's, so the newest reading from any conversation stands for all of them.
const plan = (now = Date.now()): RateLimit[] => {
  const [newest] = everyHeld()
    .filter((one) => one.usage.rateLimits.length)
    .toSorted((a, b) => b.at - a.at);
  return newest?.usage.rateLimits.filter((one) => !one.resetsAt || Date.parse(one.resetsAt) > now) ?? [];
};

// A mod older than the one that posts usage would read the ask as a message to Claude, so only a conversation that has posted is asked.
const askBreakdown = (key: string): void => {
  const own = held(key);
  if (!own || own.breakdown) return;
  void deliver({ key, text: JSON.stringify({ do: "breakdown" }), canWake: false }).catch((error: unknown) =>
    console.error(`[usage] could not ask ${key}`, error),
  );
};

export const UsageStore = { answer, askBreakdown, held, plan, Reading };
