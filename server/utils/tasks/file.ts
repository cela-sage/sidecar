import { closeSync, openSync, readdirSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Refusal } from "../../../lib/sidecar/refusal.ts";
import { Resolve } from "../../../lib/sidecar/resolve.ts";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import { Stamp } from "../../../lib/sidecar/stamp.ts";
import type { ArtifactTask } from "../../../shared/types/task.ts";

export interface TaskFile {
  path: string;
  slug: string;
  title: string;
  task: ArtifactTask;
}

const HEAD_BYTES = 4000;
const H1 = /^#[ \t]+(.+?)[ \t#]*$/m;
const COMMENTS = /<!--[\s\S]*?-->/g;

const head = (path: string): string => {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    return buffer.subarray(0, readSync(fd, buffer, 0, HEAD_BYTES, 0)).toString("utf8");
  } finally {
    closeSync(fd);
  }
};

const describe = (path: string, text: string): TaskFile | undefined => {
  const fields = Stamp.fields(text);
  const task = Stamp.task(fields);
  if (!task) return undefined;
  const slug = Resolve.slug(path);
  return { path, slug, title: fields.title || H1.exec(text.replace(COMMENTS, ""))?.[1] || slug, task };
};

const open = (given: string): TaskFile => {
  const path = Resolve.path(given);
  if (!path.endsWith(".md")) throw new Refusal(`${given} is not a .md, and only a .md is a task`, 2);
  const found = describe(path, readFileSync(path, "utf8"));
  if (!found)
    throw new Refusal(`${given} is not a task, since its stamp holds no state: artifact stamp ${given} --state unassigned`, 2);
  return found;
};

const all = (): TaskFile[] => {
  const dir = Sidecar.artifacts();
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }
  return names.flatMap((name) => describe(join(dir, name), head(join(dir, name))) ?? []);
};

const localDate = (at: Date): string =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;

// Read again at the write, since a thread may have landed in the same file a moment before.
const restamp = (file: TaskFile, task: ArtifactTask): TaskFile => {
  const patch = { project: task.project ?? "", state: task.state, updated: localDate(new Date()) };
  writeFileSync(file.path, Stamp.write(readFileSync(file.path, "utf8"), patch));
  return { ...file, task: { ...file.task, ...task } };
};

export const TaskFiles = { all, open, restamp };
