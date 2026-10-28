import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import type { TaskFile } from "./file.ts";
import { TaskHistory } from "./history.ts";

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

const home = (): string => join(Sidecar.home(), "trash");

const move = (from: string, to: string): void => {
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
};

const trash = (file: TaskFile): boolean => {
  if (dirname(file.path) !== Sidecar.artifacts()) return false;
  move(TaskHistory.file(file.slug), join(home(), `${file.slug}.jsonl`));
  move(file.path, join(home(), `${file.slug}.md`));
  return true;
};

const restore = (slug: string): boolean => {
  const kept = join(home(), `${slug}.md`);
  const back = join(Sidecar.artifacts(), `${slug}.md`);
  if (!SLUG.test(slug) || !existsSync(kept) || existsSync(back)) return false;
  move(kept, back);
  move(join(home(), `${slug}.jsonl`), TaskHistory.file(slug));
  return true;
};

export const TaskTrash = { home, restore, trash };
