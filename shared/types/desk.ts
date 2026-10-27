import type { AskKind, TaskState } from "./task.ts";

export interface DeskAsk {
  slug: string;
  title: string;
  project?: string;
  thread: string;
  kind: AskKind;
  question: string;
  from?: string;
  at: string;
}

export interface DeskTriage {
  asks: DeskAsk[];
  routes: Partial<Record<string, string>>;
}

export interface TaskAssigned {
  state: TaskState;
  project?: string;
  lead?: string;
}
