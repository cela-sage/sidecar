import assert from "node:assert/strict";
import { test } from "node:test";
import { Paragraphs } from "./paragraphs.ts";

const lines = [
  "## Pain point",
  "",
  "Your attention is scarce,",
  "and it pays twice.",
  "",
  "## Solution",
  "",
  "A board.",
];

test("a selection inside one paragraph finds the whole run of lines around it", () => {
  assert.deepEqual(Paragraphs.touched({ lines, from: 4, to: 4 }), [
    { first: 3, last: 4, text: "Your attention is scarce,\nand it pays twice." },
  ]);
});

test("a selection across a blank line touches every paragraph it crosses, and one on blank lines touches none", () => {
  assert.deepEqual(
    Paragraphs.touched({ lines, from: 3, to: 8 }).map((one) => one.first),
    [3, 6, 8],
  );
  assert.deepEqual(Paragraphs.touched({ lines, from: 2, to: 2 }), []);
});

test("a paragraph's section is the nearest heading above it", () => {
  assert.equal(Paragraphs.sectionOf(lines, 4), "Pain point");
  assert.equal(Paragraphs.sectionOf(lines, 8), "Solution");
  assert.equal(Paragraphs.sectionOf(["plain"], 1), undefined);
});
