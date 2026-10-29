export type ToolCall =
  | { kind: "read"; path: string; from?: number; to?: number }
  | { kind: "edit"; path: string }
  | { kind: "run"; command: string };

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: string[];
}

/** Counted over the whole change, so the totals stay true when the hunks are clipped. */
export interface ToolDiff {
  add: number;
  del: number;
  hunks: DiffHunk[];
  isClipped?: true;
}
