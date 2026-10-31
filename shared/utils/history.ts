import type { HistoryEntry, HistoryKind, Move } from "../types/history.ts";
import type { Role } from "../types/task.ts";
import { Titles } from "./titles.ts";
import { Workstreams } from "./workstream.ts";

export interface HistoryLine {
  lead: string;
  text: string;
  chips: string[];
  isDecision: boolean;
}

type Line = Omit<HistoryLine, "isDecision">;
type EntryOf = { [E in HistoryEntry as E["kind"]]: E };

const ROLE_NAME: Record<Role, string> = {
  EA: "the assistant",
  DL: "the Domain Lead",
  SL: "the Solution Lead",
  IC: "the Individual Contributor",
};

const moved = (move?: Move): string[] => (move ? [`${move.was} to ${move.now}`] : []);

const listed = (parts: string[]): string =>
  parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

const toldWhom = (to: string): string => {
  const role = Titles.parse(to)?.role;
  return role ? ROLE_NAME[role] : to;
};

const isMark = ({ move, who }: EntryOf["state"]): boolean => who === "YOU" && Workstreams.isArchived(move.now);

const movedTo = (entry: EntryOf["state"]): string => {
  const { move } = entry;
  if (move.now === "running" && move.was === "waiting") return "Picked it back up.";
  if (move.now === "finished") return "Finished it, and it waits on your mark.";
  if (Workstreams.isArchived(move.now)) return isMark(entry) ? "You archived it." : "Archived it.";
  return `Moved it to ${move.now}.`;
};

const stated = (entry: EntryOf["state"]): string => {
  const { move, on, reason } = entry;
  if (move.now === "waiting") return `Waiting${on ? ` on ${on}` : ""}${reason ? `: ${reason}` : "."}`;
  return reason ? `${movedTo(entry)} ${reason}` : movedTo(entry);
};

const LINES: { [K in HistoryKind]: (entry: EntryOf[K]) => Line } = {
  turn: ({ text }) => ({ lead: "", text, chips: ["turn"] }),
  message: ({ text, to }) => ({ lead: `You told ${toldWhom(to)}: `, text, chips: ["message"] }),
  state: (entry) => ({
    lead: "",
    text: stated(entry),
    chips: [...(isMark(entry) ? ["decision"] : []), ...moved(entry.move)],
  }),
  assign: ({ move, project }) => ({ lead: "", text: `Put it on ${project}.`, chips: moved(move) }),
  content: ({ parts }) => ({
    lead: "",
    text: parts.length ? `Edited ${listed(parts)}.` : "Edited the document.",
    chips: ["content change"],
  }),
  ask: ({ ask, move, text }) => ({
    lead: ask === "hire" ? "Proposed a hire: " : "Escalated: ",
    text,
    chips: [...moved(move), "notified you"],
  }),
  judge: ({ move, pick, settled, text }) => ({
    lead: settled ? "Settled it: " : "Judged it: ",
    text,
    chips: [...(pick ? [`picked option ${pick}`] : []), ...(settled ? ["settled"] : []), ...moved(move)],
  }),
  decide: ({ move, text, who }) => ({
    lead: who === "YOU" ? "You decided: " : "Settled it: ",
    text,
    chips: ["decision", ...moved(move)],
  }),
  rename: ({ now, was }) => ({ lead: "", text: `Renamed it ${now}, from ${was}.`, chips: ["renamed"] }),
  remove: ({ stopped }) => ({
    lead: "",
    text: stopped.length ? `Removed it, and stopped ${listed(stopped)}.` : "Removed it.",
    chips: ["removed"],
  }),
  read: () => ({ lead: "", text: "Read the history.", chips: [] }),
};

const lineOf = <K extends HistoryKind>(kind: K, entry: EntryOf[K]): Line => LINES[kind](entry);

const of = (entry: HistoryEntry): HistoryLine => ({
  ...lineOf(entry.kind, entry),
  isDecision: (entry.kind === "decide" && entry.who === "YOU") || (entry.kind === "state" && isMark(entry)),
});

export const HistoryLines = { of };
