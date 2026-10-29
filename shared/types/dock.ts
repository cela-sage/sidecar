export const DockKind = ["shell", "session"] as const;
export type DockKind = (typeof DockKind)[number];

export interface DockTab {
  id: string;
  project: string;
  kind: DockKind;
  title: string;
  key?: string;
}

export interface DockSize {
  cols: number;
  rows: number;
}
