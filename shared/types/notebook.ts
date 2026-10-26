export type KernelState = "busy" | "dead" | "idle" | "missing" | "off" | "starting";

export type CellRun = "cancelled" | "done" | "failed" | "queued" | "running";

export type NotebookEvent =
  | { type: "kernel"; state: KernelState; note?: string }
  | { type: "cell"; cell: string; run: CellRun; count?: number; html?: string };

export interface NotebookRunRequest {
  cells?: string[];
}
