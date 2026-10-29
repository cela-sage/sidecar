import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import z from "zod";
import { readTextSafe } from "../../../lib/files.ts";
import * as Events from "../../../lib/sidecar/events.ts";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import type { SessionCommand } from "../../../shared/types/command.ts";
import { liveSessions } from "./index.ts";
import { deliver } from "./inbox.ts";
import { entryOf } from "./registry.ts";

const List = z.array(
  z.object({
    name: z.string().min(1),
    description: z.string(),
    source: z.enum(["builtin", "plugin", "user", "mcp"]),
    plugin: z.string().optional(),
    screen: z.enum(["always", "bare"]).optional(),
    aliases: z.array(z.string()).optional(),
  }),
) satisfies z.ZodType<SessionCommand[]>;

const Held = z.object({ at: z.number(), cwd: z.string().optional(), list: List });
type Held = z.infer<typeof Held>;

const directory = (): string => join(Sidecar.home(), "commands");
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

const newest = (all: Held[]): Held | undefined => all.toSorted((a, b) => b.at - a.at)[0];

const cwdOf = (key: string): string | undefined =>
  entryOf(key)?.cwd || liveSessions({ scope: "live", key }).find((one) => one.key === key)?.cwd;

// A session that never answered, one older than the mod's answer or asleep, gets what its neighbours know.
const held = (key: string): SessionCommand[] => {
  const own = read(fileOf(key));
  if (own) return own.list;
  const all = everyHeld();
  const cwd = cwdOf(key);
  return (newest(all.filter((one) => cwd && one.cwd === cwd)) ?? newest(all))?.list ?? [];
};

// Which skills and plugins a session has changes under a running one, so every read asks it again and nobody waits.
const refresh = (key: string): void => {
  void deliver({ key, text: JSON.stringify({ do: "commands" }), canWake: false }).catch((error: unknown) =>
    console.error(`[commands] could not ask ${key}`, error),
  );
};

const answer = (key: string, list: SessionCommand[]): void => {
  const isChanged = !isDeepStrictEqual(read(fileOf(key))?.list, list);
  mkdirSync(directory(), { recursive: true });
  writeFileSync(fileOf(key), JSON.stringify({ at: Date.now(), cwd: cwdOf(key), list }));
  if (isChanged) Events.publish({ topic: "commands.changed", key, data: { key } });
};

export const SessionCommands = { answer, held, List, refresh };
