import assert from "node:assert/strict";
import { test } from "node:test";
import { PastedImages } from "./pasted-images.ts";

const SHOT = "/private/tmp/claude-501/-Users-me-Notes/70ef962c/images/2.png";

test("a message of nothing but source lines names its images, any other message names none", () => {
  assert.deepEqual(PastedImages.sourcesOf(`[Image: source: ${SHOT}]`), [SHOT]);
  assert.deepEqual(PastedImages.sourcesOf(`[Image: source: ${SHOT}]\n[Image: source: /tmp/3.jpg]`), [
    SHOT,
    "/tmp/3.jpg",
  ]);
  assert.deepEqual(PastedImages.sourcesOf(`[Image: source: ${SHOT}][Image: source: /tmp/3.jpg]`), [SHOT, "/tmp/3.jpg"]);
  assert.deepEqual(PastedImages.sourcesOf(`look at [Image: source: ${SHOT}]`), []);
  assert.deepEqual(PastedImages.sourcesOf(`[Image: source: ${SHOT}]\nand then?`), []);
});

test("the marker's number is the number its file is saved under", () => {
  assert.equal(PastedImages.numberOf(SHOT), 2);
  assert.equal(PastedImages.numberOf("/tmp/shot.png"), undefined);
});

test("a marker splits the words around it and keeps their order", () => {
  assert.deepEqual(PastedImages.partsOf("[Image #2] mind the window, and [Image #3]"), [
    { kind: "image", number: 2 },
    { kind: "text", text: " mind the window, and " },
    { kind: "image", number: 3 },
  ]);
  assert.deepEqual(PastedImages.partsOf("no pictures"), [{ kind: "text", text: "no pictures" }]);
});
