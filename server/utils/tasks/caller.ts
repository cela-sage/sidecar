import type { Who } from "../../../shared/types/task.ts";
import { Titles } from "../../../shared/utils/titles.ts";
import { keyOf } from "../sessions/paths.ts";
import { liveEntries, type RegistryEntry } from "../sessions/registry.ts";

export interface Caller {
  who: Who;
  from?: string;
}

const newest = (a: RegistryEntry, b: RegistryEntry): number => (b.updatedAt || 0) - (a.updatedAt || 0);

const titleOf = (id: string): string | undefined => {
  const [entry] = liveEntries()
    .filter((one) => one.id === id)
    .sort(newest);
  return entry?.name;
};

const keyByTitle = (title: string): string | undefined => {
  const [entry] = liveEntries()
    .filter((one) => one.name === title)
    .sort(newest);
  return entry && keyOf(entry.id);
};

// A conversation whose title carries no role token is Marco's own, so what it does lands as his.
const of = (id = process.env.CLAUDE_CODE_SESSION_ID): Caller => {
  const from = id ? titleOf(id) : undefined;
  const role = from ? Titles.parse(from)?.role : undefined;
  return { who: role ?? "YOU", ...(from ? { from } : {}) };
};

export const TaskCaller = { keyByTitle, of };
