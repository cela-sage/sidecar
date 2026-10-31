import type { ArtifactTask } from "../types/task.ts";

const isArchived = (task: ArtifactTask): boolean => task.state === "done";

export const Workstreams = { isArchived };
