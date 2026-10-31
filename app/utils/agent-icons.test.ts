import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentIcons, type AgentCell } from "./agent-icons.ts";

const linked = (cells: AgentCell[]): boolean => {
  const keys = new Set(cells.map(({ row, col }) => `${row}:${col}`));
  const seen = new Set<string>();
  const walk = (row: number, col: number): void => {
    const key = `${row}:${col}`;
    if (!keys.has(key) || seen.has(key)) return;
    seen.add(key);
    [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ].forEach(([next, other]) => walk(next ?? 0, other ?? 0));
  };
  const [first] = cells;
  if (first) walk(first.row, first.col);
  return seen.size === keys.size;
};

test("every icon in the pack is a mirrored 5 by 5 glyph of 11 to 16 cells, one 4-connected shape that fills the tile", () => {
  for (let icon = 0; icon < AgentIcons.count; icon++) {
    const cells = AgentIcons.cellsOf(icon);
    const has = (row: number, col: number): boolean => cells.some((one) => one.row === row && one.col === col);
    assert.ok(cells.length >= 11 && cells.length <= 16, `icon ${icon} has ${cells.length} cells`);
    assert.ok(
      cells.every(({ row, col }) => has(row, 4 - col)),
      `icon ${icon} is not mirrored`,
    );
    assert.ok(linked(cells), `icon ${icon} is not one shape`);
    assert.equal(new Set(cells.map((one) => one.row)).size, 5, `icon ${icon} leaves a row empty`);
    assert.equal(new Set(cells.map((one) => one.col)).size, 5, `icon ${icon} leaves a column empty`);
  }
});

test("an icon index wraps around the pack, and the eight inks are dealt in turn", () => {
  assert.deepEqual(AgentIcons.cellsOf(64), AgentIcons.cellsOf(0));
  assert.deepEqual(AgentIcons.cellsOf(-1), AgentIcons.cellsOf(63));
  assert.deepEqual([0, 1, 7, 8, 63, 64].map(AgentIcons.inkOf), [0, 1, 7, 0, 7, 0]);
});
