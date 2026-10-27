import type { HistoryEntry, HistoryKind } from "../../shared/types/history.ts";
import type { TaskState, Who } from "../../shared/types/task.ts";
import { HistoryLines } from "../../shared/utils/history.ts";

export interface TimelineRow {
  key: number;
  at: string;
  who: Who;
  kind: HistoryKind;
  lead: string;
  text: string;
  chips: string[];
  isDecision: boolean;
  thread?: string;
  parts?: string[];
  folded: number[];
}

export interface TaskStory {
  settledBy?: Who;
  waiting?: { on?: string; reason?: string; since: string };
  resumed?: { on?: string; at: string; waited: string };
  done?: { at: string };
}

const FOLD_MS = 30 * 60_000;

const threadOf = (entry: HistoryEntry): string | undefined =>
  entry.kind === "ask" || entry.kind === "judge" || entry.kind === "decide" ? entry.thread : undefined;

const sameRun = (row: TimelineRow, entry: HistoryEntry): boolean => {
  if (row.kind !== entry.kind || row.who !== entry.who) return false;
  if (entry.kind === "turn") return true;
  return entry.kind === "content" && Date.parse(row.at) - Date.parse(entry.at) < FOLD_MS;
};

const rowOf = (entry: HistoryEntry, key: number): TimelineRow => {
  const line = HistoryLines.of(entry);
  const thread = threadOf(entry);
  return {
    key,
    at: entry.at,
    who: entry.who,
    kind: entry.kind,
    lead: line.lead,
    text: line.text,
    chips: line.chips,
    isDecision: line.isDecision,
    ...(thread ? { thread } : {}),
    ...(entry.kind === "content" ? { parts: entry.parts } : {}),
    folded: [key],
  };
};

const merged = (row: TimelineRow, entry: HistoryEntry, key: number): TimelineRow => {
  const folded = [...row.folded, key];
  if (entry.kind === "turn") return { ...row, folded, chips: [`${folded.length} turns`] };
  if (entry.kind !== "content") return row;
  const parts = [...new Set([...(row.parts ?? []), ...entry.parts])];
  return { ...row, folded, parts, text: HistoryLines.of({ ...entry, parts }).text };
};

const rows = (entries: HistoryEntry[], { decisionsOnly = false }: { decisionsOnly?: boolean } = {}): TimelineRow[] => {
  const out: TimelineRow[] = [];
  for (let key = entries.length - 1; key >= 0; key--) {
    const entry = entries[key];
    if (!entry || entry.kind === "read") continue;
    if (decisionsOnly && !HistoryLines.of(entry).isDecision) continue;
    const last = out.at(-1);
    if (last && !decisionsOnly && sameRun(last, entry)) out[out.length - 1] = merged(last, entry, key);
    else out.push(rowOf(entry, key));
  }
  return out;
};

const readAt = (entries: HistoryEntry[]): string | undefined =>
  entries.findLast((entry) => entry.kind === "read" && entry.who === "PL")?.at;

const dividerAt = (list: TimelineRow[], read?: string): number | undefined => {
  if (!read || !list[0] || list[0].at <= read) return undefined;
  return list.find((row) => row.at <= read)?.key;
};

const span = (from: string, to: string): string => {
  const minutes = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
};

const story = (entries: HistoryEntry[], state: TaskState): TaskStory => {
  const moves = entries.flatMap((entry) => ("move" in entry && entry.move ? [{ entry, move: entry.move }] : []));
  const last = moves.at(-1);
  if (!last || last.move.now !== state) return {};
  const waited = moves.findLast(({ move }) => move.now === "waiting")?.entry;
  const on = waited?.kind === "state" ? waited.on : undefined;
  if (state === "waiting" && last.entry.kind === "state") {
    const { at, reason } = last.entry;
    return { waiting: { ...(on ? { on } : {}), ...(reason ? { reason } : {}), since: at } };
  }
  if (state === "done") return { done: { at: last.entry.at } };
  if (state !== "running") return {};
  if (last.move.was === "waiting" && waited)
    return { resumed: { ...(on ? { on } : {}), at: last.entry.at, waited: span(waited.at, last.entry.at) } };
  if (last.move.was === "blocked" && last.entry.kind === "decide") return { settledBy: last.entry.who };
  return {};
};

export const Timeline = { dividerAt, readAt, rows, span, story };
