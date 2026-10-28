import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readTextSafe } from "../../../lib/files.ts";
import type { Project } from "../../../shared/types/task.ts";
import { bare } from "../models/bare.ts";
import { Projects } from "../projects.ts";
import type { TaskFile } from "../tasks/file.ts";

const INSTRUCTION =
  "Each task below waits in the inbox. Pick the one project it belongs to from the projects listed, or none when the task says too little to tell. Answer with one line per task, written as slug: project key or slug: none, and nothing else.";
const NONE = "none";
const TASK_CHARS = 900;
const PROJECT_CHARS = 500;
const COMMENTS = /<!--[\s\S]*?-->/g;

const known = new Map<string, string>();
const running = new Map<string, Promise<void>>();

const signatureOf = (file: TaskFile): string => {
  const { mtimeMs, size } = statSync(file.path);
  return `${file.slug}@${size}:${mtimeMs}`;
};

const projectLine = (project: Project): string => {
  const about = (readTextSafe(join(project.folder, "CLAUDE.md")) ?? "").replace(COMMENTS, "").slice(0, PROJECT_CHARS);
  return `${project.key} (${project.name}, ${project.folder}):\n${about.replace(/\s+/g, " ").trim()}`;
};

const taskLine = (file: TaskFile): string =>
  `${file.slug}: ${readFileSync(file.path, "utf8").replace(COMMENTS, "").replace(/\s+/g, " ").trim().slice(0, TASK_CHARS)}`;

const ask = async (files: TaskFile[], projects: Project[]): Promise<void> => {
  const prompt = `Projects\n${projects.map(projectLine).join("\n\n")}\n\nTasks\n${files.map(taskLine).join("\n\n")}`;
  const text = await bare({ model: "haiku", prompt, system: INSTRUCTION });
  const keys = [...projects.map((one) => one.key), NONE];
  for (const line of text.split("\n")) {
    const [, slug, key] = /^[\s*-]*`?([\w.-]+)`?\s*:\s*`?([\w-]+)`?/.exec(line) ?? [];
    const file = files.find((one) => one.slug === slug);
    if (file && key && keys.includes(key.toLowerCase())) known.set(signatureOf(file), key.toLowerCase());
  }
};

const of = async (inbox: TaskFile[]): Promise<Partial<Record<string, string>>> => {
  const missing = inbox.filter((file) => !known.has(signatureOf(file)));
  if (missing.length) {
    const batch = missing.map(signatureOf).join(" ");
    const pending = running.get(batch) ?? ask(missing, Projects.list()).finally(() => running.delete(batch));
    running.set(batch, pending);
    await pending;
  }
  return Object.fromEntries(
    inbox.flatMap((file) => {
      const key = known.get(signatureOf(file));
      return key && key !== NONE ? [[file.slug, key]] : [];
    }),
  );
};

export const DeskRoutes = { of };
