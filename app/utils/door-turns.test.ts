import assert from "node:assert/strict";
import { test } from "node:test";
import type { BusyTurn } from "../../shared/utils/busy.ts";
import { DoorTurns, type DoorFollower, type DoorTurnsExchange } from "./door-turns.ts";

const exchange = (id: string): DoorTurnsExchange => ({ id, step: "working" });
const follower = (id: string): DoorFollower => ({ id, isOurs: false, isWaiting: false });

const ended = new Set<DoorFollower>();

const replay = (thread: DoorTurnsExchange[], followers: DoorFollower[], turns: BusyTurn[]): void => {
  for (const turn of turns) {
    for (const one of followers) if (!ended.has(one) && DoorTurns.hear(thread, one, turn)) ended.add(one);
  }
};

const FIRST: BusyTurn[] = [
  { role: "user", text: "Find the theme toggle" },
  { role: "assistant", kind: "acting", tool: "Grep", text: "" },
  { role: "system", kind: "done", text: "" },
];

test("a second message handed over mid-turn leaves one live line and one answer, on the last exchange", () => {
  const thread = [exchange("first")];
  const followers = [follower("first")];
  replay(thread, followers, FIRST);
  assert.deepEqual([...DoorTurns.linesOf(thread)], [["first", "live"]]);

  thread.push(exchange("second"));
  followers.push(follower("second"));
  replay(thread, followers, [{ role: "user", text: "and its dark tokens", queued: true }]);
  assert.deepEqual(
    [...DoorTurns.linesOf(thread)],
    [
      ["first", "live"],
      ["second", "queued"],
    ],
  );

  replay(thread, followers, [
    { role: "assistant", kind: "narration", text: "Reading the toggle" },
    { role: "system", kind: "drop", text: "" },
    { role: "assistant", kind: "acting", tool: "Read", text: "" },
  ]);
  assert.deepEqual([...DoorTurns.linesOf(thread)], [["second", "live"]]);

  replay(thread, followers, [
    { role: "assistant", kind: "answer", text: "The toggle is in tokens.css, dark under data-theme" },
    { role: "system", kind: "end", text: "" },
  ]);
  assert.deepEqual(
    thread.map(({ step, answer }) => [step, answer]),
    [
      ["answered", undefined],
      ["answered", "The toggle is in tokens.css, dark under data-theme"],
    ],
  );
});

test("a message the queue hands over after the turn ended gets its own turn, and both keep their answer", () => {
  const thread = [exchange("first"), exchange("second")];
  const followers = [follower("first")];
  replay(thread, followers, FIRST.slice(0, 1));
  followers.push(follower("second"));
  replay(thread, followers, [
    { role: "user", text: "and its dark tokens", queued: true },
    { role: "assistant", kind: "answer", text: "In tokens.css" },
    { role: "system", kind: "end", text: "" },
    { role: "system", kind: "drop", text: "" },
    { role: "user", text: "and its dark tokens" },
    { role: "assistant", kind: "answer", text: "Under data-theme" },
    { role: "system", kind: "end", text: "" },
  ]);
  assert.deepEqual(
    thread.map(({ answer }) => answer),
    ["In tokens.css", "Under data-theme"],
  );
});
