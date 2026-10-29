import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { read } from "../../../lib/sidecar/events.ts";
import { TurnBus } from "./busy.ts";
import { OpenQuestions } from "./questions.ts";

const PICK = { "Which color?": "Blue" };
const QUESTIONS = [{ question: "Which color?", options: [{ label: "Red" }, { label: "Blue" }] }];

let dir = "";
before(() => {
  dir = mkdtempSync(join(tmpdir(), "sidecar-questions-"));
  process.env.CLAUDE_CONFIG_DIR = dir;
});
after(() => {
  delete process.env.CLAUDE_CONFIG_DIR;
  rmSync(dir, { recursive: true, force: true });
});

test("an open question is published with its key, marks the conversation asking, and closes once", () => {
  OpenQuestions.ask({ key: "abcd1234", ref: "call-open", questions: QUESTIONS });
  assert.deepEqual(TurnBus.snapshot().abcd1234, { doing: true, asking: true });
  assert.deepEqual(
    OpenQuestions.open().map((one) => one.ref),
    ["call-open"],
  );
  assert.equal(OpenQuestions.has("call-open"), true);
  OpenQuestions.close("call-open");
  OpenQuestions.close("call-open");
  assert.equal(OpenQuestions.has("call-open"), false);
  assert.deepEqual(TurnBus.snapshot().abcd1234, { doing: true, asking: false });
  assert.deepEqual(OpenQuestions.open(), []);
  const frames = read().events.filter((one) => one.topic === "question.changed");
  assert.deepEqual(
    frames.map((one) => one.data),
    [
      { key: "abcd1234", ref: "call-open", questions: QUESTIONS },
      { key: "abcd1234", ref: "call-open" },
    ],
  );
});

test("an answer reaches the hook already waiting on that call", async () => {
  const waiting = OpenQuestions.wait("call-a", { holdMs: 1_000 });
  assert.equal(await OpenQuestions.give("call-a", PICK), true);
  assert.deepEqual(await waiting, PICK);
});

test("an answer that lands between two polls waits for the next one", async () => {
  const given = OpenQuestions.give("call-b", PICK, 500);
  assert.deepEqual(await OpenQuestions.wait("call-b", { holdMs: 1_000 }), PICK);
  assert.equal(await given, true);
});

test("an answer nobody waits for is refused once the grace ends", async () => {
  assert.equal(await OpenQuestions.give("call-c", PICK, 20), false);
  assert.equal(await OpenQuestions.wait("call-c", { holdMs: 20 }), undefined);
});

test("a hold ends empty, and a release, a close or an abort ends it at once", async () => {
  assert.equal(await OpenQuestions.wait("call-d", { holdMs: 20 }), undefined);
  const released = OpenQuestions.wait("call-e", { holdMs: 5_000 });
  OpenQuestions.release("call-e");
  assert.equal(await released, undefined);
  const closed = OpenQuestions.wait("call-h", { holdMs: 5_000 });
  OpenQuestions.close("call-h");
  assert.equal(await closed, undefined);
  const stop = new AbortController();
  const aborted = OpenQuestions.wait("call-f", { holdMs: 5_000, signal: stop.signal });
  stop.abort();
  assert.equal(await aborted, undefined);
});

test("a newer poll on the same call replaces the older one", async () => {
  const older = OpenQuestions.wait("call-g", { holdMs: 5_000 });
  const newer = OpenQuestions.wait("call-g", { holdMs: 5_000 });
  assert.equal(await older, undefined);
  assert.equal(await OpenQuestions.give("call-g", PICK), true);
  assert.deepEqual(await newer, PICK);
});
