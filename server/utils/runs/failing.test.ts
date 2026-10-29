import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RunOutput } from "./failing.ts";

describe("RunOutput.failingLines", () => {
  it("keeps the lines that name a failure, without their colours", () => {
    const output = "\x1b[32m✓ adds\x1b[0m\r\n\x1b[31m✗ subtracts\x1b[0m\r\nexpected 1 to be 2\r\nTests 1 failed | 1 passed\r\n";
    assert.deepEqual(RunOutput.failingLines(output), ["✗ subtracts", "Tests 1 failed | 1 passed"]);
  });

  it("keeps what a progress bar drew last", () => {
    assert.deepEqual(RunOutput.failingLines("building 10%\rbuilding 90%\rError: out of memory\n"), [
      "Error: out of memory",
    ]);
  });

  it("falls back to the last 15 lines when nothing names a failure", () => {
    const output = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n");
    const lines = RunOutput.failingLines(output);
    assert.equal(lines.length, 15);
    assert.equal(lines[0], "line 15");
    assert.equal(lines.at(-1), "line 29");
  });

  it("caps the matched lines at the last 40", () => {
    const output = Array.from({ length: 60 }, (_, i) => `error ${i}`).join("\n");
    const lines = RunOutput.failingLines(output);
    assert.equal(lines.length, 40);
    assert.equal(lines[0], "error 20");
  });
});
