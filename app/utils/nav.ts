export type Place = { kind: "conversation"; key: string } | { kind: "channel"; slug: string; thread?: string };

export interface NavHistory {
  places: Place[];
  at: number;
}

export interface Stop {
  at: number;
  place: Place;
}

const CAP = 50;

const sameAs = (a: Place | undefined, b: Place): boolean => {
  if (!a || a.kind !== b.kind) return false;
  return a.kind === "conversation" ? b.kind === "conversation" && a.key === b.key : b.kind === "channel" && a.slug === b.slug;
};

// Opening a thread is not a move, so the same place only refreshes its entry and Back returns to the pane as it was.
const EMPTY: NavHistory = { places: [], at: -1 };

const visit = (history: NavHistory, place: Place): NavHistory => {
  if (sameAs(history.places[history.at], place))
    return { ...history, places: history.places.map((one, at) => (at === history.at ? place : one)) };
  const places = [...history.places.slice(0, history.at + 1), place].slice(-CAP);
  return { places, at: places.length - 1 };
};

const step = (history: NavHistory, by: 1 | -1, exists: (place: Place) => boolean): Stop | undefined => {
  for (let at = history.at + by; at >= 0 && at < history.places.length; at += by) {
    const place = history.places[at];
    if (place && exists(place)) return { at, place };
  }
  return undefined;
};

export const Nav = { empty: EMPTY, sameAs, step, visit };
