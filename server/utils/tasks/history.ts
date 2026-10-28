import { appendFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import z from "zod";
import { readTextSafe } from "../../../lib/files.ts";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import type { HistoryEntry } from "../../../shared/types/history.ts";
import { AskKind, TaskState } from "../../../shared/types/task.ts";
import { WHO } from "./ask.ts";

const Said = { at: z.string(), who: WHO, from: z.string().optional() };
const Move = z.object({ was: z.enum(TaskState), now: z.enum(TaskState) });
const Kind = z.enum(AskKind);

const Entry = z.discriminatedUnion("kind", [
  z.object({ ...Said, kind: z.literal("turn"), text: z.string() }),
  z.object({ ...Said, kind: z.literal("message"), text: z.string(), to: z.string() }),
  z.object({ ...Said, kind: z.literal("state"), move: Move, reason: z.string().optional(), on: z.string().optional() }),
  z.object({ ...Said, kind: z.literal("assign"), project: z.string(), move: Move.optional() }),
  z.object({ ...Said, kind: z.literal("content"), parts: z.array(z.string()) }),
  z.object({
    ...Said,
    kind: z.literal("ask"),
    thread: z.string(),
    ask: Kind,
    text: z.string(),
    options: z.array(z.string()),
    move: Move.optional(),
  }),
  z.object({
    ...Said,
    kind: z.literal("judge"),
    thread: z.string(),
    text: z.string(),
    pick: z.number().optional(),
    settled: z.literal(true).optional(),
    move: Move.optional(),
  }),
  z.object({
    ...Said,
    kind: z.literal("decide"),
    thread: z.string(),
    ask: Kind,
    text: z.string(),
    option: z.number().optional(),
    move: Move.optional(),
  }),
  z.object({ ...Said, kind: z.literal("rename"), was: z.string(), now: z.string() }),
  z.object({ ...Said, kind: z.literal("remove"), stopped: z.array(z.string()) }),
  z.object({ ...Said, kind: z.literal("read") }),
]) satisfies z.ZodType<HistoryEntry>;

const home = (): string => join(Sidecar.home(), "history");
const file = (slug: string): string => join(home(), `${slug}.jsonl`);

const entryOf = (line: string): HistoryEntry[] => {
  if (!line.trim()) return [];
  try {
    const parsed = Entry.safeParse(JSON.parse(line));
    return parsed.success ? [parsed.data] : [];
  } catch {
    return [];
  }
};

// One write per line under O_APPEND, so the CLI in a Task Lead and the server never interleave a line.
const append = (slug: string, entry: HistoryEntry): void => {
  mkdirSync(home(), { recursive: true });
  appendFileSync(file(slug), `${JSON.stringify(entry)}\n`);
};

const read = (slug: string): HistoryEntry[] => (readTextSafe(file(slug)) ?? "").split("\n").flatMap(entryOf);

const signature = (slug: string): string | undefined => {
  try {
    const { mtimeMs, size } = statSync(file(slug));
    return `${size}:${mtimeMs}`;
  } catch {
    return undefined;
  }
};

export const TaskHistory = { append, file, home, read, signature };
