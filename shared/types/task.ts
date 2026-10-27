export const TaskState = ["unassigned", "assigned", "assessed", "running", "blocked", "waiting", "done"] as const;
export type TaskState = (typeof TaskState)[number];

export const Role = ["EA", "PL", "DL", "TL"] as const;
export type Role = (typeof Role)[number];

export interface ArtifactTask {
  project?: string;
  state: TaskState;
  lead?: string;
}

export interface Project {
  key: string;
  name: string;
  token: string;
  folder: string;
}
