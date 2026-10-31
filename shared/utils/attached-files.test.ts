import assert from "node:assert/strict";
import { test } from "node:test";
import { AttachedFiles } from "./attached-files.ts";
import { UploadedFiles } from "./uploaded-files.ts";

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

test("files go after the words behind a blank line, and a message of files alone is only their lines", () => {
  assert.equal(
    AttachedFiles.append("  why?  ", [SHOT, LOG]),
    `why?\n\n${AttachedFiles.line(SHOT)}\n${AttachedFiles.line(LOG)}`,
  );
  assert.equal(AttachedFiles.append("", [SHOT]), AttachedFiles.line(SHOT));
  assert.equal(AttachedFiles.append(" why? ", []), "why?");
});

test("only a saved upload has a route to draw from, and a filter keeps the other images as lines", () => {
  const CHART = "/tmp/chart.png";
  assert.equal(UploadedFiles.srcOf(SHOT), "/uploads/door/shot.png");
  assert.equal(UploadedFiles.srcOf(CHART), undefined);
  assert.equal(UploadedFiles.srcOf("/Users/me/.claude/sidecar/uploads/door/a/b.png"), undefined);
  assert.equal(UploadedFiles.srcOf("/Users/me/.claude/sidecar/uploads/door/..png"), undefined);

  const said = `look\n\n${AttachedFiles.line(SHOT)}\n${AttachedFiles.line(CHART)}`;
  assert.deepEqual(
    AttachedFiles.imagesOf(said, (path) => !!UploadedFiles.srcOf(path)),
    {
      text: `look\n\n${AttachedFiles.line(CHART)}`,
      paths: [SHOT],
    },
  );
});

test("an Attached line quoted mid-message is words, and a relative path is not a file the sidecar saved", () => {
  const quoted = `the line ${AttachedFiles.line(SHOT)} is added\nby the prompt`;
  assert.deepEqual(AttachedFiles.imagesOf(quoted), { text: quoted, paths: [] });
  assert.deepEqual(AttachedFiles.imagesOf("Attached: shot.png"), { text: "Attached: shot.png", paths: [] });
});
