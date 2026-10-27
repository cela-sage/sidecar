import type { Feed, HistoryEntry, HistoryKind, Move } from "../types/history.ts";

export interface HistoryLine {
  lead: string;
  text: string;
  chips: string[];
  feed?: Feed;
  isDecision: boolean;
}

type Line = Omit<HistoryLine, "feed" | "isDecision">;
type EntryOf = { [E in HistoryEntry as E["kind"]]: E };

const FEED: Record<HistoryKind, Feed | undefined> = {
  turn: "turn",
  message: "message",
  state: "change",
  assign: "change",
  content: "change",
  ask: "ask",
  judge: "ask",
  decide: "ask",
  read: undefined,
};

const moved = (move?: Move): string[] => (move ? [`${move.was} to ${move.now}`] : []);

const listed = (parts: string[]): string =>
  parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

const stated = ({ move, on, reason }: EntryOf["state"]): string => {
  if (move.now === "waiting") return `Waiting${on ? ` on ${on}` : ""}${reason ? `: ${reason}` : "."}`;
  const said =
    move.now === "running" && move.was === "waiting"
      ? "Picked it back up."
      : move.now === "done"
        ? "Marked it done."
        : `Moved it to ${move.now}.`;
  return reason ? `${said} ${reason}` : said;
};

const LINES: { [K in HistoryKind]: (entry: EntryOf[K]) => Line } = {
  turn: ({ text }) => ({ lead: "", text, chips: ["turn"] }),
  message: ({ text }) => ({ lead: "You told the Task Lead: ", text, chips: ["message"] }),
  state: (entry) => ({ lead: "", text: stated(entry), chips: moved(entry.move) }),
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
  judge: ({ pick, text }) => ({ lead: "Judged it: ", text, chips: pick ? [`picked option ${pick}`] : [] }),
  decide: ({ move, text, who }) => ({
    lead: who === "YOU" ? "You decided: " : "Settled it: ",
    text,
    chips: ["decision", ...moved(move)],
  }),
  read: () => ({ lead: "", text: "Read the history.", chips: [] }),
};

const lineOf = <K extends HistoryKind>(kind: K, entry: EntryOf[K]): Line => LINES[kind](entry);

const of = (entry: HistoryEntry): HistoryLine => ({
  ...lineOf(entry.kind, entry),
  feed: FEED[entry.kind],
  isDecision: entry.kind === "decide" && entry.who === "YOU",
});

export const HistoryLines = { of, feedOf: (kind: HistoryKind): Feed | undefined => FEED[kind] };
