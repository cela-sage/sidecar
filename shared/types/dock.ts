import type { RunStatus } from "./runs.ts";

export const DockKind = ["shell", "session", "run"] as const;
export type DockKind = (typeof DockKind)[number];

export interface DockTab {
  id: string;
  project: string;
  kind: DockKind;
  title: string;
  key?: string;
  config?: string;
  status?: RunStatus;
  failing?: string[];
}

export interface DockSize {
  cols: number;
  rows: number;
}
