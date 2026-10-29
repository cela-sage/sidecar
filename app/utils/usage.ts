import type { RateLimit } from "~~/shared/types/usage";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const PACE_AFTER = 0.1;

const WINDOWS = {
  five_hour: { label: "5h", name: "5-hour", ms: 5 * HOUR, isPaced: true },
  seven_day: { label: "7d", name: "7-day", ms: 7 * DAY, isPaced: false },
} as const;

export interface PlanRow {
  kind: keyof typeof WINDOWS;
  label: string;
  name: string;
  percent: number;
  resetsAt: number;
  hitsAt?: number;
}

export interface PlanNote {
  text: string;
  isPace: boolean;
}

const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

const isKnown = (kind: string): kind is PlanRow["kind"] => Object.hasOwn(WINDOWS, kind);

const isToday = (at: number, now: number): boolean => new Date(at).toDateString() === new Date(now).toDateString();

const stamp = (at: number, now: number): string =>
  isToday(at, now) ? clock.format(at) : `${weekday.format(at)} ${clock.format(at)}`;

const span = (ms: number, minuteWord = "minutes"): string => {
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return `${minutes} ${minuteWord}`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  const days = Math.round(ms / DAY);
  return `${days} ${days === 1 ? "day" : "days"}`;
};

const until = (ms: number): string => `in ${span(ms, "min")}`;

const hitOf = ({ percent, resetsAt, ms, now }: { percent: number; resetsAt: number; ms: number; now: number }) => {
  const start = resetsAt - ms;
  const elapsed = now - start;
  if (percent <= 0 || percent >= 100 || elapsed < ms * PACE_AFTER) return undefined;
  const hitsAt = start + (elapsed * 100) / percent;
  return hitsAt < resetsAt ? hitsAt : undefined;
};

const rows = (limits: RateLimit[], now: number): PlanRow[] =>
  limits.flatMap(({ kind, percentUsed, resetsAt }) => {
    const reset = Date.parse(resetsAt ?? "");
    if (!isKnown(kind) || !(reset > now)) return [];
    const { label, name, ms, isPaced } = WINDOWS[kind];
    const percent = Math.round(percentUsed);
    const hitsAt = isPaced ? hitOf({ percent: percentUsed, resetsAt: reset, ms, now }) : undefined;
    return [{ kind, label, name, percent, resetsAt: reset, hitsAt }];
  });

const reset = ({ resetsAt }: PlanRow, now: number): string =>
  `Resets ${stamp(resetsAt, now)} · ${until(resetsAt - now)}`;

const note = (list: PlanRow[], now: number): PlanNote | undefined => {
  const full = list.find((one) => one.percent >= 100);
  if (full) {
    const when = isToday(full.resetsAt, now) ? `at ${clock.format(full.resetsAt)}` : stamp(full.resetsAt, now);
    return {
      text: `You've reached the ${full.name} limit. Claude picks up again ${when}, and every conversation keeps its place.`,
      isPace: false,
    };
  }
  const [soonest] = list.filter((one) => one.hitsAt).toSorted((a, b) => (a.hitsAt ?? 0) - (b.hitsAt ?? 0));
  if (!soonest?.hitsAt) return undefined;
  const gap = span(soonest.resetsAt - soonest.hitsAt);
  return {
    text: `At this pace the ${soonest.name} limit hits at ${stamp(soonest.hitsAt, now)}, ${gap} before it resets.`,
    isPace: true,
  };
};

const kilo = (tokens: number): string => (tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens));

const compacted = (
  { at, sizes, text }: { at: number; sizes?: { before: number; after: number }; text: string },
  time: Intl.DateTimeFormat,
): string => (sizes ? `${text} · ${kilo(sizes.before)} → ${kilo(sizes.after)} · ${time.format(at)}` : text);

export const Usage = { compacted, kilo, note, reset, rows };
