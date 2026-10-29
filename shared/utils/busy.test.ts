import assert from "node:assert/strict";
import { test } from "node:test";
import { BusyRules, type Busy, type BusyTurn } from "./busy.ts";

const run = (turns: BusyTurn[], was: Busy = BusyRules.IDLE): Busy =>
  turns.reduce((now, turn) => BusyRules.next(now, turn).now, was);

test("a conversation is doing from the prompt until its turn ends, and asking only while a question is open", () => {
  const prompt: BusyTurn = { role: "user", text: "fix it" };
  assert.deepEqual(run([prompt]), { doing: true, asking: false });
  assert.deepEqual(run([prompt, { role: "assistant", kind: "acting", tool: "Bash" }]), { doing: true, asking: false });
  const asked = run([prompt, { role: "assistant", kind: "acting", tool: "AskUserQuestion" }]);
  assert.deepEqual(asked, { doing: true, asking: true });
  assert.deepEqual(run([{ role: "system", kind: "done" }], asked), { doing: true, asking: false });
  assert.deepEqual(run([prompt, { role: "system", kind: "end" }]), BusyRules.IDLE);
});

test("an interruption ends the turn, since it rarely writes its turn_duration line", () => {
  const working = run([
    { role: "user", text: "go" },
    { role: "assistant", kind: "acting", tool: "Read" },
  ]);
  assert.deepEqual(run([{ role: "system", kind: "note", text: "Interrupted" }], working), BusyRules.IDLE);
  assert.deepEqual(run([{ role: "system", kind: "summary", text: "Compacted" }], working), working);
});

test("a queued prompt and a stray tool result never start a turn", () => {
  assert.deepEqual(run([{ role: "user", text: "later", queued: true }]), BusyRules.IDLE);
  assert.deepEqual(run([{ role: "system", kind: "done" }]), BusyRules.IDLE);
});

test("narration arms the quiet timer and a tool call does not", () => {
  assert.equal(BusyRules.next(BusyRules.IDLE, { role: "assistant", kind: "narration" }).quiet, true);
  assert.equal(BusyRules.next(BusyRules.IDLE, { role: "assistant", kind: "acting", tool: "Edit" }).quiet, false);
});
