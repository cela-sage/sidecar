export const TaskState = ["unassigned", "assigned", "assessed", "running", "blocked", "waiting", "done"] as const;
export type TaskState = (typeof TaskState)[number];

export const Role = ["EA", "PL", "DL", "TL"] as const;
export type Role = (typeof Role)[number];
export type Who = Role | "YOU";

export const AskKind = ["escalation", "hire"] as const;
export type AskKind = (typeof AskKind)[number];

export interface AskVerdict {
  from?: string;
  text: string;
  pick?: number;
  at: string;
}

export interface AskDecision {
  who: Who;
  from?: string;
  text: string;
  option?: number;
  at: string;
}

export interface TaskAsk {
  kind: AskKind;
  from?: string;
  options: string[];
  verdict?: AskVerdict;
  decision?: AskDecision;
}

export interface ArtifactTask {
  project?: string;
  state: TaskState;
  lead?: string;
  doneAt?: string;
  hidden?: true;
}

export interface Project {
  key: string;
  name: string;
  token: string;
  folder: string;
}
