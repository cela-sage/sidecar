import z from "zod";
import { TaskState, type ArtifactTask } from "../../shared/types/task.ts";
import { pad } from "../text.ts";

export const StampField = ["slug", "title", "url", "target", "ds", "updated", "project", "state", "lead"] as const;
export type StampField = (typeof StampField)[number];
export type StampFields = Partial<Record<StampField, string>>;

const BLOCK = /<!--\s*artifact\b([\s\S]*?)-->/;
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;
const STATE = z.enum(TaskState);

const isField = (key: string): key is StampField => (StampField as readonly string[]).includes(key);

const fields = (head: string): StampFields => {
  const found: StampFields = {};
  for (const line of BLOCK.exec(head)?.[1]?.split("\n") ?? []) {
    const at = line.indexOf(":");
    const key = line.slice(0, at).trim().toLowerCase();
    if (at > 0 && isField(key)) found[key] = line.slice(at + 1).trim();
  }
  return found;
};

// Mode's `artifact stamp` layout, field order and padding included, so either writer leaves the other's block unchurned.
const write = (text: string, patch: StampFields): string => {
  const merged: StampFields = { ...fields(text), ...patch };
  const body = StampField.filter((key) => merged[key])
    .map((key) => `${pad(`${key}:`, 9)}${merged[key]}`)
    .join("\n");
  const block = `<!-- artifact\n${body}\n-->`;
  if (BLOCK.test(text)) return text.replace(BLOCK, () => block);
  const at = FRONTMATTER.exec(text)?.[0].length ?? 0;
  return `${text.slice(0, at)}${block}\n${text.slice(at)}`;
};

// Mirrors the stamp writer in Mode: a task with no project is unassigned whatever its state line says.
const task = ({ lead, project, state }: StampFields): ArtifactTask | undefined => {
  const parsed = STATE.safeParse(state);
  if (!parsed.success) return undefined;
  return { state: project ? parsed.data : "unassigned", ...(project ? { project } : {}), ...(lead ? { lead } : {}) };
};

export const Stamp = { fields, task, write };
