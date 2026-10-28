import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readTextSafe } from "../../../lib/files.ts";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import type { ArtifactMeta } from "../../../shared/types/artifact.ts";
import { TaskHistory } from "./history.ts";

// Mode's stamp writer drops fields it does not know, so whether you took a task off the list lives beside it instead.
const file = (): string => join(Sidecar.home(), "tasks-hidden.json");

const shelved = (): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(readTextSafe(file()) ?? "{}");
    return typeof parsed === "object" && !!parsed && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const save = (next: Record<string, string>): void => {
  mkdirSync(dirname(file()), { recursive: true });
  writeFileSync(file(), `${JSON.stringify(next, undefined, 2)}\n`);
};

const hide = (slug: string): void => save({ ...shelved(), [slug]: new Date().toISOString() });

const show = (slug: string): void => {
  const { [slug]: was, ...rest } = shelved();
  if (was) save(rest);
};

const doneAt = (slug: string): string | undefined =>
  TaskHistory.read(slug).findLast((entry) => "move" in entry && entry.move?.now === "done")?.at;

const mark = (metas: ArtifactMeta[]): ArtifactMeta[] => {
  const hidden = shelved();
  return metas.map((meta) => {
    if (meta.task?.state !== "done") return meta;
    const at = doneAt(meta.slug);
    return {
      ...meta,
      task: { ...meta.task, ...(at ? { doneAt: at } : {}), ...(hidden[meta.slug] ? { hidden: true } : {}) },
    };
  });
};

export const TaskShelf = { file, hide, mark, show };
