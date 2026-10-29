import assert from "node:assert/strict";
import { test } from "node:test";
import { Usage } from "./usage.ts";

const at = (hour: number, minute = 0, day = 1): number => new Date(2026, 0, day, hour, minute).getTime();
const iso = (when: number): string => new Date(when).toISOString();
const limits = (five: number, resetsAt: number) => [
  { kind: "five_hour", percentUsed: five, resetsAt: iso(resetsAt) },
  { kind: "seven_day", percentUsed: 68, resetsAt: iso(at(9, 0, 5)) },
  { kind: "spend_limit", percentUsed: 5, resetsAt: iso(at(23)) },
];

test("the plan keeps the two windows it draws, and says when each resets", () => {
  const now = at(12, 10);
  const list = Usage.rows(limits(42, at(14, 20)), now);

  assert.deepEqual(
    list.map((one) => [one.label, one.percent]),
    [
      ["5h", 42],
      ["7d", 68],
    ],
  );
  assert.deepEqual(
    list.map((one) => Usage.reset(one, now)),
    ["Resets 14:20 · in 2h 10m", "Resets Mon 09:00 · in 4 days"],
  );
  assert.deepEqual(
    Usage.rows(limits(42, at(11)), now).map((one) => one.label),
    ["7d"],
  );
});

test("a window that will run out before it resets says when, and a full one says when Claude picks up", () => {
  const now = at(12, 10);
  const pace = Usage.rows(limits(78, at(14, 20)), now);
  assert.equal(Usage.note(pace, now)?.text, "At this pace the 5-hour limit hits at 12:57, 1h 22m before it resets.");
  assert.equal(Usage.note(Usage.rows(limits(30, at(14, 20)), now), now), undefined);
  assert.equal(
    Usage.note(Usage.rows(limits(100, at(14, 20)), now), now)?.text,
    "You've reached the 5-hour limit. Claude picks up again at 14:20, and every conversation keeps its place.",
  );
});

test("a compaction reads its sizes in thousands", () => {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const turn = { at: at(10, 52), text: "Compacted" };

  assert.equal(
    Usage.compacted({ ...turn, sizes: { before: 124_000, after: 32_400 } }, time),
    "Compacted · 124k → 32k · 10:52",
  );
  assert.equal(Usage.compacted(turn, time), "Compacted");
  assert.equal(Usage.kilo(1_000_000), "1M");
});

test("the note reads what the mod measured when it has the compaction, and the transcript's count when it has not", () => {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const turn = { at: at(10, 52), text: "Compacted", sizes: { before: 106_000, after: 23_000 } };
  const measured = [
    { at: at(9, 0), before: 50_000, after: 45_000 },
    { at: at(10, 52) + 2000, before: 106_000, after: 90_000 },
  ];

  assert.equal(Usage.compacted(turn, time, measured), "Compacted · 106k → 90k · 10:52");
  assert.equal(Usage.compacted(turn, time, measured.slice(0, 1)), "Compacted · 106k → 23k · 10:52");
  assert.equal(Usage.compacted(turn, time), "Compacted · 106k → 23k · 10:52");
});
