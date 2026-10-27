import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import z from "zod";
import { readTextSafe } from "../../../lib/files.ts";
import type { HistoryEntry, TaskStands } from "../../../shared/types/history.ts";
import type { TaskState } from "../../../shared/types/task.ts";
import { HistoryLines } from "../../../shared/utils/history.ts";
import { Models } from "../models/index.ts";
import { TaskHistory } from "./history.ts";

export interface StandsInput {
  slug: string;
  title: string;
  state: TaskState;
}

const INSTRUCTION =
  "Say where this task stands for a Project Lead picking it up cold: whether it runs on its own, waits on a third party or needs Marco, what Marco decided, and what comes next. Name people by role, use plain words, and give no heading.";
const ENTRIES = 120;
const ENTRY_CHARS = 400;
const CONTEXT_CHARS = 12_000;

const Cached = z.object({
  signature: z.string(),
  stands: z.object({ text: z.string(), at: z.string(), count: z.number() }),
});

const cacheFile = (slug: string): string => join(TaskHistory.home(), `${slug}.stands.json`);
const running = new Map<string, Promise<TaskStands | undefined>>();

const cached = (slug: string): z.infer<typeof Cached> | undefined => {
  try {
    return Cached.safeParse(JSON.parse(readTextSafe(cacheFile(slug)) ?? "")).data;
  } catch {
    return undefined;
  }
};

const said = (entry: HistoryEntry): string => {
  const { lead, text } = HistoryLines.of(entry);
  return `${entry.at} ${entry.who} ${lead}${text}`.replace(/\s+/g, " ").slice(0, ENTRY_CHARS);
};

const write = async ({ slug, title, state }: StandsInput, signature: string): Promise<TaskStands | undefined> => {
  const entries = TaskHistory.read(slug).filter((entry) => entry.kind !== "read");
  if (!entries.length) return undefined;
  const context = `${title}, ${state} now.\n${entries.slice(-ENTRIES).map(said).join("\n")}`.slice(-CONTEXT_CHARS);
  const reply = await Models.fast({ task: "answer", instruction: INSTRUCTION, selection: "", context });
  const text = (reply.kind === "answer" ? reply.text : reply.replacement).trim();
  const stands = { text, at: new Date().toISOString(), count: entries.length };
  mkdirSync(TaskHistory.home(), { recursive: true });
  writeFileSync(cacheFile(slug), `${JSON.stringify({ signature, stands })}\n`);
  return stands;
};

const of = (input: StandsInput): Promise<TaskStands | undefined> => {
  const signature = TaskHistory.signature(input.slug);
  if (!signature) return Promise.resolve(undefined);
  const hit = cached(input.slug);
  if (hit?.signature === signature) return Promise.resolve(hit.stands);
  const key = `${input.slug}@${signature}`;
  const pending = running.get(key) ?? write(input, signature).finally(() => running.delete(key));
  running.set(key, pending);
  return pending;
};

export const TaskStanding = { of };
