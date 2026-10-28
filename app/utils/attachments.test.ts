import assert from "node:assert/strict";
import { test } from "node:test";
import { Attachments } from "./attachments.ts";
import { Mentions } from "./mentions.ts";

const SHOT = { name: "image.png", path: "/Users/me/.claude/sidecar/uploads/door/image.png" };
const LOG = { name: "build.log", path: "/Users/me/.claude/sidecar/uploads/door/build.log" };

test("a file goes in as @name at the caret, spaced from the words around it", () => {
  assert.deepEqual(Attachments.insert({ text: "look at", caret: 7 }, "image.png"), {
    text: "look at @image.png ",
    caret: 19,
  });
  assert.deepEqual(Attachments.insert({ text: "", caret: 0 }, "image.png"), { text: "@image.png ", caret: 11 });
});

test("the message carries each path on its own line, only for files still in the text", () => {
  const text = "why does @image.png show this, and not the log?";
  assert.equal(
    Attachments.message(text, [SHOT, LOG]),
    `${text}\n\nAttached: /Users/me/.claude/sidecar/uploads/door/image.png`,
  );
  assert.equal(Attachments.message("no file here", [SHOT]), "no file here");
});

test("a file token is found on its own, and never reads as a conversation pick", () => {
  const text = "@image.png and @image.png2 and @build.log";
  assert.deepEqual(
    Attachments.of(text, [SHOT, LOG]).map((one) => [one.name, text.slice(one.start, one.end)]),
    [
      ["image.png", "@image.png"],
      ["build.log", "@build.log"],
    ],
  );
  assert.deepEqual(Mentions.of(text), []);
});
