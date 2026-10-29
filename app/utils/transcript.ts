export interface Sequenced {
  text: string;
  kind?: string;
}

export interface CommandReceipts<T extends Sequenced> {
  join: (turn: T, held: readonly T[]) => boolean;
  clear: () => void;
}

const isNote = ({ kind }: Sequenced): boolean => kind === "note" || kind === "summary";

// A compaction emits the same note from two entries seconds apart, so `at` cannot join them.
export const echoesNote = (turn: Sequenced, previous?: Sequenced): boolean =>
  !!previous && isNote(turn) && isNote(previous) && previous.text === turn.text;

// The terminal writes a typed command as raw input and again as a receipt, possibly in another slice, so a receipt is the command still unpaired.
export const commandReceipts = <T extends Sequenced>(): CommandReceipts<T> => {
  const receipts = new Set<T>();
  return {
    join: (turn, held) => {
      if (turn.kind !== "command") return false;
      const typed = held.findLast((row) => !isNote(row));
      if (typed?.kind !== "command" || typed.text !== turn.text || receipts.has(typed)) return false;
      receipts.add(turn);
      return true;
    },
    clear: () => receipts.clear(),
  };
};
