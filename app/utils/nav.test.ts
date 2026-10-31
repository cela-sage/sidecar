import assert from "node:assert/strict";
import { test } from "node:test";
import { Nav, type NavHistory, type Place } from "./nav.ts";

const conversation = (key: string): Place => ({ kind: "conversation", key });
const channel = (slug: string, thread?: string): Place => ({ kind: "channel", slug, ...(thread ? { thread } : {}) });

const walk = (places: Place[]): NavHistory => places.reduce(Nav.visit, Nav.empty);

test("the same place refreshes its entry, and a new place after Back drops what was forward", () => {
  const opened = walk([conversation("a"), channel("board"), channel("board", "p1")]);
  assert.deepEqual(opened, { places: [conversation("a"), channel("board", "p1")], at: 1 });
  const back = { ...opened, at: 0 };
  assert.deepEqual(Nav.visit(back, conversation("a")), back);
  assert.deepEqual(Nav.visit(back, conversation("b")), { places: [conversation("a"), conversation("b")], at: 1 });
});

test("Back and Forward skip places that are gone and stop at either end, and the history is capped", () => {
  const history = walk([conversation("a"), conversation("gone"), channel("board")]);
  const exists = (place: Place): boolean => place.kind !== "conversation" || place.key !== "gone";
  assert.deepEqual(Nav.step(history, -1, exists), { at: 0, place: conversation("a") });
  assert.equal(Nav.step({ ...history, at: 0 }, -1, exists), undefined);
  assert.equal(Nav.step({ ...history, at: 0 }, 1, exists)?.at, 2);
  assert.equal(Nav.step(history, 1, exists), undefined);
  const long = walk(Array.from({ length: 60 }, (_, at) => conversation(String(at))));
  assert.deepEqual([long.places.length, long.at, long.places[0]], [50, 49, conversation("10")]);
});
