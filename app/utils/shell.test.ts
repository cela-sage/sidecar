import assert from "node:assert/strict";
import { test } from "node:test";
import { windowFrame } from "./shell.ts";

test("the desktop window drags from its rows and keeps room for the lights, a browser tab does neither", () => {
  assert.deepEqual(windowFrame({ isFull: false, isFullScreen: false, isShell: true }), { drags: true, hasLights: true });
  assert.deepEqual(windowFrame({ isFull: false, isFullScreen: false, isShell: false }), {
    drags: false,
    hasLights: false,
  });
});

test("fullscreen drops the lights' room but still drags, and a grown sheet stops the drag but keeps the room", () => {
  assert.deepEqual(windowFrame({ isFull: false, isFullScreen: true, isShell: true }), { drags: true, hasLights: false });
  assert.deepEqual(windowFrame({ isFull: true, isFullScreen: false, isShell: true }), { drags: false, hasLights: true });
});
