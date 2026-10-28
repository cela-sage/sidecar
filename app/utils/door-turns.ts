import type { BusyTurn } from "~~/shared/utils/busy";

export type DoorStep = "working" | "answered" | "waiting" | "failed";
export type DoorLine = "live" | "queued";

export interface DoorTurnsExchange {
  id: string;
  step: DoorStep;
  isQueued?: boolean;
  isFolded?: boolean;
  answer?: string;
}

export interface DoorFollower {
  id: string;
  isOurs: boolean;
  isWaiting: boolean;
  said?: string;
}

// Sent mid-turn, a message lands queued, and once handed over it joins the turn already running, which answers the earlier ones with it.
const hear = (thread: DoorTurnsExchange[], follower: DoorFollower, turn: BusyTurn): boolean => {
  const at = thread.findIndex((one) => one.id === follower.id);
  const one = thread[at];
  if (!one) return false;
  if (!follower.isOurs && turn.role === "user" && turn.queued) {
    follower.isWaiting = true;
    one.isQueued = true;
    return false;
  }
  if (!follower.isOurs && ((turn.role === "user" && !turn.queued) || (follower.isWaiting && turn.kind === "drop"))) {
    follower.isOurs = true;
    one.isQueued = false;
    for (const earlier of thread.slice(0, at)) {
      if (earlier.step === "working" && !earlier.isQueued) earlier.isFolded = true;
    }
    return false;
  }
  if (!follower.isOurs) return false;
  if (turn.kind === "end") {
    one.step = "answered";
    one.answer = one.isFolded ? undefined : follower.said;
    return true;
  }
  if (turn.role === "assistant" && (turn.kind === "narration" || turn.kind === "answer")) follower.said = turn.text;
  return false;
};

const linesOf = (thread: DoorTurnsExchange[]): Map<string, DoorLine> => {
  const open = thread.filter((one) => one.step === "working");
  const live = open.findLast((one) => !one.isQueued);
  const lines = new Map<string, DoorLine>();
  for (const one of open) {
    if (one.isQueued) lines.set(one.id, "queued");
    else if (one === live) lines.set(one.id, "live");
  }
  return lines;
};

export const DoorTurns = { hear, linesOf };
