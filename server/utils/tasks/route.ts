import { createError } from "h3";
import { Refusal } from "../../../lib/sidecar/refusal.ts";
import { readArtifact } from "../artifacts.ts";
import type { TaskFile } from "./file.ts";

const task = async (slug: string): Promise<TaskFile> => {
  const source = await readArtifact(slug);
  if (!source?.task) throw createError({ statusCode: 404, statusMessage: `no task matching '${slug}'` });
  return { path: source.path, slug: source.slug, title: source.title || source.slug, task: source.task };
};

const refused = (error: unknown): never => {
  if (!(error instanceof Refusal)) throw error;
  throw createError({ statusCode: 409, statusMessage: "refused", message: error.message });
};

export const TaskRoute = { refused, task };
