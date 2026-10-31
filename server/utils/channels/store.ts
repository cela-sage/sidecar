import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import z from "zod";
import { readTextSafe } from "../../../lib/files.ts";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import { Role } from "../../../shared/types/task.ts";

const Said = { id: z.string(), at: z.string() };
const By = { by: z.string().optional() };
const Keys = z.array(z.string());

const Entry = z.discriminatedUnion("kind", [
  z.object({
    ...Said,
    kind: z.literal("post"),
    by: z.string(),
    text: z.string(),
    thread: z.string().optional(),
    broadcast: z.literal(true).optional(),
    mentions: z.object({
      keys: Keys,
      outside: Keys,
      all: z.literal(true).optional(),
      boss: z.literal(true).optional(),
    }),
  }),
  z.object({ ...Said, kind: z.literal("reach"), post: z.string(), notified: Keys, missed: Keys }),
  z.object({
    ...Said,
    ...By,
    kind: z.literal("join"),
    key: z.string(),
    title: z.string(),
    role: z.enum(Role),
    killed: z.literal(true).optional(),
  }),
  z.object({ ...Said, ...By, kind: z.literal("kill"), keys: Keys }),
  z.object({ ...Said, ...By, kind: z.literal("resume"), keys: Keys }),
  z.object({ ...Said, ...By, kind: z.literal("archive") }),
  z.object({ ...Said, ...By, kind: z.literal("restore") }),
  z.object({ ...Said, kind: z.literal("read"), key: z.string(), upto: z.string(), post: z.string().optional() }),
  z.object({ ...Said, kind: z.literal("dm"), from: z.string(), to: z.string(), text: z.string() }),
]);

const Offset = z.coerce.number().int().nonnegative().catch(0);

export type ChannelEntry = z.infer<typeof Entry>;
export type PostMentions = Extract<ChannelEntry, { kind: "post" }>["mentions"];
type Unsaid<T> = T extends unknown ? Omit<T, "id" | "at"> & { at?: string } : never;
export type NewEntry = Unsaid<ChannelEntry>;

const home = (): string => join(Sidecar.home(), "channels");
const file = (slug: string): string => join(home(), `${slug}.jsonl`);
const uid8 = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 8);

const entryOf = (line: string): ChannelEntry[] => {
  if (!line.trim()) return [];
  try {
    const parsed = Entry.safeParse(JSON.parse(line));
    return parsed.success ? [parsed.data] : [];
  } catch {
    return [];
  }
};

// One write per line under O_APPEND, so an agent's CLI and the server never interleave a line.
const append = (slug: string, entry: NewEntry): ChannelEntry => {
  const saved: ChannelEntry = { id: uid8(), at: new Date().toISOString(), ...entry };
  mkdirSync(home(), { recursive: true });
  appendFileSync(file(slug), `${JSON.stringify(saved)}\n`);
  return saved;
};

const read = (slug: string): ChannelEntry[] => (readTextSafe(file(slug)) ?? "").split("\n").flatMap(entryOf);

const slugs = (): string[] => {
  try {
    return readdirSync(home())
      .filter((name) => name.endsWith(".jsonl"))
      .map((name) => name.slice(0, -".jsonl".length));
  } catch {
    return [];
  }
};

const offsetFile = (slug: string): string => join(home(), `${slug}.offset`);

// Where the channel's last catch-up stopped in events.jsonl, kept apart so a read that finds nothing writes no line.
const offset = (slug: string): number => Offset.parse(readTextSafe(offsetFile(slug))?.trim());

const advance = (slug: string, to: number): void => {
  mkdirSync(home(), { recursive: true });
  writeFileSync(offsetFile(slug), `${to}\n`);
};

export const ChannelStore = { advance, append, offset, read, slugs };
