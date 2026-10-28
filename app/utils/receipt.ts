import type { Project } from "~~/shared/types/task";
import { Tasks, type TaskMeta } from "./tasks.ts";

export interface ReceiptLine {
  title: string;
  where?: { project: Project; tint: string };
}

export interface ReceiptSources {
  tasks: TaskMeta[];
  projects: Project[];
}

const lineOf = ({ slug, title }: { slug: string; title: string }, { tasks, projects }: ReceiptSources): ReceiptLine => {
  const meta = tasks.find((one) => one.slug === slug);
  const key = meta?.task.project;
  if (!key) return { title: meta?.title || title };
  const project = projects.find((one) => one.key === key) ?? { key, name: key, token: key, folder: "" };
  const keys = projects.map((one) => one.key);
  return { title: meta?.title || title, where: { project, tint: Tasks.tintOf(project.key, keys) } };
};

export const Receipts = { lineOf };
