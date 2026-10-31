const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function homePath(cwd: string): string {
  const home = cwd.match(/^\/Users\/[^/]+/)?.[0];
  return home ? `~${cwd.slice(home.length)}` : cwd;
}

const SIZE_UNITS = [
  { unit: "kilobyte", from: 1024 },
  { unit: "megabyte", from: 1024 * 1024 },
  { unit: "gigabyte", from: 1024 * 1024 * 1024 },
] as const;

export const sizeLabel = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const { unit, from } = SIZE_UNITS.findLast((one) => bytes >= one.from) ?? SIZE_UNITS[0];
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: from >= 1024 * 1024 ? 1 : 0,
    style: "unit",
    unit,
    unitDisplay: "short",
  }).format(bytes / from);
};

export function basename(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

/** Slugs are the fallback when an artifact carries no title of its own. */
export function deslug(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug;
}

export function relativeAge(stamp?: string, now: number = Date.now()): string {
  if (!stamp) return "";
  const at = Date.parse(stamp);
  if (Number.isNaN(at)) return stamp;
  const ago = Math.max(now - at, 0);
  if (ago < MINUTE) return "just now";
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} hr`;
  const days = Math.floor(ago / DAY);
  return days === 1 ? "1 day" : `${days} days`;
}

/** "user" is the seed's own word for the person at the keyboard; the design shows the author as YOU. */
export function authorOf(by: string): string {
  return by === "user" ? "you" : by;
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export const clockOf = (stamp: string | undefined, now: Date = new Date()): string => {
  const at = stamp ? new Date(stamp) : undefined;
  if (!at || Number.isNaN(at.getTime())) return "";
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (at.toDateString() === now.toDateString()) return time;
  return `${at.toLocaleDateString([], { day: "numeric", month: "short" })} · ${time}`;
};

export const andList = (names: string[]): string =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** Flattens first: a prompt's newlines would otherwise survive into a one-line label. */
export function shorten(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
