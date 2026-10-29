import type { ToolDiff } from "~~/shared/types/conversation";
import type { ConversationTurn } from "~/composables/useConversation";

export type ToolState = "live" | "done" | "failed" | "quiet";

export interface ReadFile {
  path: string;
  name: string;
  lines?: [number, number];
}

interface Base {
  key: string;
  state: ToolState;
  label: string;
  meta?: string;
}

export type ToolRow =
  | (Base & { kind: "read"; files: ReadFile[] })
  | (Base & { kind: "edit"; path: string; diff?: ToolDiff })
  | (Base & { kind: "run"; command: string; out?: string })
  | (Base & { kind: "other"; out?: string });

export interface ToolRowsInput {
  turns: ConversationTurn[];
  results: Map<string, ConversationTurn>;
  isBusy: boolean;
}

interface Called {
  turn: ConversationTurn;
  state: ToolState;
  key: string;
  result?: ConversationTurn;
}

const VERBS: Partial<Record<string, [string, string]>> = {
  Edit: ["Editing", "Edited"],
  MultiEdit: ["Editing", "Edited"],
  NotebookEdit: ["Editing", "Edited"],
  Write: ["Writing", "Wrote"],
};

const nameOf = (path: string): string => path.split("/").filter(Boolean).at(-1) ?? path;
const firstLine = (text: string): string => text.split("\n")[0]?.trim() ?? text;

const stateOf = (result: ConversationTurn | undefined, isBusy: boolean): ToolState => {
  if (result) return result.failed ? "failed" : "done";
  return isBusy ? "live" : "quiet";
};

const readOf = ({ call }: ConversationTurn): ReadFile[] => {
  if (call?.kind !== "read") return [];
  const { path, from, to } = call;
  return [{ path, name: nameOf(path), ...(from ? { lines: [from, to ?? from] as [number, number] } : {}) }];
};

const rowOf = ({ turn, state, key, result }: Called): ToolRow => {
  const isLive = state === "live";
  const { call } = turn;
  if (call?.kind === "edit") {
    const [doing, did] = VERBS[turn.tool ?? ""] ?? ["Editing", "Edited"];
    const label = `${isLive ? doing : did} ${turn.arg ?? nameOf(call.path)}`;
    return { key, kind: "edit", state, label, path: call.path, ...(result?.diff ? { diff: result.diff } : {}) };
  }
  const out = result?.out ? { out: result.out } : {};
  if (call?.kind === "run") {
    const command = firstLine(call.command);
    const meta = turn.arg && turn.arg !== command ? { meta: turn.arg } : {};
    return { key, kind: "run", state, label: `${isLive ? "Running" : "Ran"} ${command}`, command: call.command, ...meta, ...out };
  }
  const label = (turn.tool ?? "Tool").replace(/^mcp__[^_]+__/, "");
  return { key, kind: "other", state, label, ...(turn.arg ? { meta: turn.arg } : {}), ...out };
};

const readsOf = (reads: Called[]): ToolRow => {
  const files = reads.flatMap(({ turn }) => readOf(turn));
  const states = reads.map((one) => one.state);
  const state = (["live", "failed", "done"] as const).find((one) => states.includes(one)) ?? "quiet";
  const verb = state === "live" ? "Reading" : "Read";
  const key = reads[0]?.key ?? "reads";
  const [only] = files;
  if (files.length === 1 && only) {
    const meta = only.lines ? { meta: `:${only.lines[0]}–${only.lines[1]}` } : {};
    return { key, kind: "read", state, label: `${verb} ${only.name}`, files, ...meta };
  }
  const meta = files.map((one) => one.name).join(" · ");
  return { key, kind: "read", state, label: `${verb} ${files.length} files`, meta, files };
};

// Consecutive reads fold into one row, since a file per row would bury the edit they led to.
const of = ({ turns, results, isBusy }: ToolRowsInput): ToolRow[] => {
  const rows: ToolRow[] = [];
  let reads: Called[] = [];
  const flush = (): void => {
    if (reads.length) rows.push(readsOf(reads));
    reads = [];
  };
  for (const [at, turn] of turns.entries()) {
    const result = turn.ref ? results.get(turn.ref) : undefined;
    const called: Called = { turn, result, state: stateOf(result, isBusy), key: turn.ref ?? `${turn.at}-${at}` };
    if (turn.call?.kind === "read") {
      reads.push(called);
      continue;
    }
    flush();
    rows.push(rowOf(called));
  }
  flush();
  return rows;
};

export const ToolRows = { of };
