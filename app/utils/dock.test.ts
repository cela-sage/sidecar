import assert from "node:assert/strict";
import { test } from "node:test";
import type { DockTab } from "../../shared/types/dock.ts";
import { DockOrder } from "./dock.ts";

const shell = (id: string): DockTab => ({ id, project: "cela", kind: "shell", title: "zsh" });
const a = shell("a");
const b = shell("b");
const c = shell("c");
const d = shell("d");
const idsOf = (tabs: DockTab[]): string[] => tabs.map((one) => one.id);

test("the saved order leads and a tab it does not name follows in the server's order", () => {
  assert.deepEqual(idsOf(DockOrder.arranged([a, b, c, d], ["c", "a"])), ["c", "a", "b", "d"]);
  assert.deepEqual(idsOf(DockOrder.arranged([a, b, c], undefined)), ["a", "b", "c"]);
});

test("a moved tab lands at its place among the others, and the other tool's ids stay behind it", () => {
  assert.deepEqual(DockOrder.placed({ tabs: [a, b, c], tab: c, to: 0 }), ["c", "a", "b"]);
  assert.deepEqual(DockOrder.placed({ tabs: [a, b, c], ids: ["a", "b", "c"], tab: a, to: 2 }), ["b", "c", "a"]);
  assert.deepEqual(DockOrder.placed({ tabs: [a, b], ids: ["x", "a", "b"], tab: b, to: 0 }), ["b", "a", "x"]);
});

test("putting a tab back where it stands changes nothing", () => {
  assert.deepEqual(DockOrder.placed({ tabs: [a, b, c], ids: ["a", "b", "c"], tab: b, to: 1 }), ["a", "b", "c"]);
});
