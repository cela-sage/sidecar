export interface Busy {
  doing: boolean;
  asking: boolean;
}

export interface BusyTurn {
  role: "user" | "assistant" | "system";
  text?: string;
  kind?: string;
  tool?: string;
  queued?: boolean;
}

export interface BusyStep {
  now: Busy;
  quiet: boolean;
}

// Tool calls follow a narration in well under this, so a longer silence after one means the turn ended.
const QUIET_MS = 2_500;
const IDLE: Busy = { doing: false, asking: false };

// An interrupted turn rarely writes its turn_duration line, so the interruption itself ends it.
const isOver = ({ kind, text }: BusyTurn): boolean => kind === "end" || (kind === "note" && text === "Interrupted");

const next = (was: Busy, turn: BusyTurn): BusyStep => {
  if (isOver(turn)) return { now: IDLE, quiet: false };
  if (turn.kind === "done") return { now: { ...was, asking: false }, quiet: false };
  if (turn.role === "user") return { now: turn.queued ? was : { doing: true, asking: false }, quiet: false };
  if (turn.role === "system") return { now: was, quiet: false };
  if (turn.kind === "acting") return { now: { doing: true, asking: turn.tool === "AskUserQuestion" }, quiet: false };
  if (turn.kind === "narration" || turn.kind === "thinking")
    return { now: { doing: true, asking: false }, quiet: true };
  return { now: IDLE, quiet: false };
};

const same = (a: Busy, b: Busy): boolean => a.doing === b.doing && a.asking === b.asking;

export const BusyRules = { IDLE, QUIET_MS, next, same };
