import assert from "node:assert/strict";
import { test } from "node:test";
import { AttachedFiles } from "./attached-files.ts";

const SHOT = "/Users/me/.claude/sidecar/uploads/door/shot.png";
const LOG = "/Users/me/.claude/sidecar/uploads/door/build.log";

test("the trailing Attached lines of an image leave the text, the others stay in it", () => {
  const said = `why does this fail?\n\n${AttachedFiles.line(SHOT)}\n${AttachedFiles.line(LOG)}`;
  assert.deepEqual(AttachedFiles.imagesOf(said), {
    text: `why does this fail?\n\n${AttachedFiles.line(LOG)}`,
    paths: [SHOT],
  });
  assert.deepEqual(AttachedFiles.imagesOf(AttachedFiles.line(SHOT)), { text: "", paths: [SHOT] });
});

test("an Attached line quoted mid-message is words, and a relative path is not a file the sidecar saved", () => {
  const quoted = `the line ${AttachedFiles.line(SHOT)} is added\nby the prompt`;
  assert.deepEqual(AttachedFiles.imagesOf(quoted), { text: quoted, paths: [] });
  assert.deepEqual(AttachedFiles.imagesOf("Attached: shot.png"), { text: "Attached: shot.png", paths: [] });
});
