import type { AskKind, TaskState, Who } from "./task.ts";

export interface Said {
  at: string;
  who: Who;
  from?: string;
}

export interface Move {
  was: TaskState;
  now: TaskState;
}

export type HistoryEntry =
  | (Said & { kind: "turn"; text: string })
  | (Said & { kind: "message"; text: string; to: string })
  | (Said & { kind: "state"; move: Move; reason?: string; on?: string })
  | (Said & { kind: "assign"; project: string; move?: Move })
  | (Said & { kind: "content"; parts: string[] })
  | (Said & { kind: "ask"; thread: string; ask: AskKind; text: string; options: string[]; move?: Move })
  | (Said & { kind: "judge"; thread: string; text: string; pick?: number })
  | (Said & { kind: "decide"; thread: string; ask: AskKind; text: string; option?: number; move?: Move })
  | (Said & { kind: "rename"; was: string; now: string })
  | (Said & { kind: "remove"; stopped: string[] })
  | (Said & { kind: "read" });

export type HistoryKind = HistoryEntry["kind"];

export interface TaskStands {
  text: string;
  at: string;
  count: number;
}

export interface TaskDecided {
  text: string;
  state: TaskState;
  told: boolean;
}
