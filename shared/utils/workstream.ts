import type { TaskState } from "../types/task.ts";

const isArchived = (state: TaskState): boolean => state === "archived";

export const Workstreams = { isArchived };
