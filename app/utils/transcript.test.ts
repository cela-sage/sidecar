import assert from "node:assert/strict";
import { test } from "node:test";
import { commandReceipts, echoesNote, isRun } from "./transcript.ts";

interface Drawn {
  kind: string;
  text: string;
}

const drawn = (turns: Drawn[]): string[] => {
  const receipts = commandReceipts<Drawn>();
  const held: Drawn[] = [];
  return turns.flatMap((turn) => {
    const joined = receipts.join(turn, held);
    held.push(turn);
    return joined ? [] : [turn.text];
  });
};

test("the Simple chat drops narration, calls and notes and keeps the words", () => {
  for (const kind of ["narration", "acting", "note"]) assert.equal(isRun({ kind, text: "" }), true, kind);
  for (const kind of ["answer", "command", "printed", "summary", undefined]) {
    assert.equal(isRun({ kind, text: "" }), false, String(kind));
  }
});

test("only a note repeated back to back is an echo", () => {
  const note = { kind: "note", text: "Command(compact)" };
  assert.equal(echoesNote(note, { ...note }), true);
  assert.equal(echoesNote(note, undefined), false);
  assert.equal(echoesNote(note, { kind: "command", text: "Command(compact)" }), false);
});

test("a compaction typed in the terminal draws its command once, with the notes it caused around it", () => {
  assert.deepEqual(
    drawn([
      { kind: "command", text: "/compact" },
      { kind: "note", text: "Compacted" },
      { kind: "command", text: "/compact" },
      { kind: "note", text: "Hook(PostCompact)" },
    ]),
    ["/compact", "Compacted", "Hook(PostCompact)"],
  );
});

test("the same command typed twice is two lines, and a command after something else is its own", () => {
  const command = (): Drawn => ({ kind: "command", text: "/mode:ic" });
  assert.deepEqual(drawn([command(), command(), command(), command()]), ["/mode:ic", "/mode:ic"]);
  assert.deepEqual(drawn([command(), { kind: "printed", text: "ok" }, command()]), ["/mode:ic", "ok", "/mode:ic"]);
});
