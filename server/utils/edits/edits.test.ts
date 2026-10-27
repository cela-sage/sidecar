import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MarkdownEdits } from "./markdown.ts";
import { MarkdownSource } from "./source.ts";

const TEXT = "# Plan\n\nShip it today.\n\nSecond paragraph\nover two lines.\n\n```md\nShip it today.\n\nmore\n```\n";
const sha1 = (text: string): string => createHash("sha1").update(text).digest("hex");

test("a paragraph becomes a del and ins proposal in place, and accept keeps the new text while revert gives the file back byte for byte", () => {
  const made = MarkdownEdits.apply({ replacement: "Ship it now.", selection: "Ship it today.", text: TEXT });
  if (!made.ok || !made.id) assert.fail(`apply refused: ${JSON.stringify(made)}`);
  assert.match(made.id, /^[0-9a-f]{12}$/);
  assert.equal(
    made.text,
    TEXT.replace(
      "Ship it today.\n\nSecond",
      `<del data-sc-edit="${made.id}">\n\nShip it today.\n\n</del>\n<ins data-sc-edit="${made.id}">\n\nShip it now.\n\n</ins>\n\nSecond`,
    ),
  );

  const accepted = MarkdownEdits.resolve({ action: "accept", id: made.id, text: made.text });
  if (!accepted.ok) assert.fail(accepted.reason);
  assert.equal(accepted.text, TEXT.replace("Ship it today.\n\nSecond", "Ship it now.\n\nSecond"));
  const reverted = MarkdownEdits.resolve({ action: "revert", id: made.id, text: made.text });
  if (!reverted.ok) assert.fail(reverted.reason);
  assert.equal(reverted.text, TEXT);
});

test("a paragraph that is gone, repeated, empty, already proposed or unknown is refused, and code fences are never cut", () => {
  const apply = (selection: string, text: string = TEXT, replacement = "x") =>
    MarkdownEdits.apply({ replacement, selection, text });
  assert.deepEqual(apply("Gone."), { ok: false, reason: "stale" });
  assert.deepEqual(apply("A", "A\n\nA\n"), { ok: false, reason: "ambiguous" });
  assert.deepEqual(apply("Ship it today.", TEXT, "  "), { ok: false, reason: "invalid" });
  assert.deepEqual(apply(" \n"), { ok: false, reason: "invalid" });
  assert.deepEqual(apply("more"), { ok: false, reason: "stale" });

  const made = apply("Ship it today.");
  if (!made.ok) assert.fail(made.reason);
  assert.deepEqual(apply("Ship it today.", made.text), { ok: false, reason: "stale" });
  assert.deepEqual(MarkdownEdits.resolve({ action: "accept", id: "ffffffffffff", text: made.text }), {
    ok: false,
    reason: "not-found",
  });
});

test("a source save lands over the text it opened and refuses a base that the file has moved past", async () => {
  const dir = mkdtempSync(join(tmpdir(), "source-"));
  const path = join(dir, "task.md");
  try {
    writeFileSync(path, "one\n");
    assert.deepEqual(await MarkdownSource.save({ base: sha1("one\n"), path, text: "two\n" }), {
      saved: true,
      hash: sha1("two\n"),
    });
    assert.deepEqual(await MarkdownSource.save({ base: sha1("one\n"), path, text: "three\n" }), {
      saved: false,
      reason: "changed-on-disk",
    });
    assert.equal(readFileSync(path, "utf8"), "two\n");
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
