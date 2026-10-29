import assert from "node:assert/strict";
import { test } from "node:test";
import { SlashCommand } from "./slash-command.ts";

test("a slash and a name open a command, and the rest of the text is its arguments", () => {
  assert.deepEqual(SlashCommand.parse("/compact"), { name: "compact", args: "" });
  assert.deepEqual(SlashCommand.parse("  /mode:ic  new glass\nfor the nav "), { name: "mode:ic", args: "new glass\nfor the nav" });
  assert.equal(SlashCommand.line({ name: "style", args: "edu" }), "/style edu");
  assert.equal(SlashCommand.line({ name: "compact", args: "" }), "/compact");
});

test("a path or a slash later in the text is a message", () => {
  assert.equal(SlashCommand.parse("/Users/madong/Notes"), undefined);
  assert.equal(SlashCommand.parse("//comment"), undefined);
  assert.equal(SlashCommand.parse("run /compact when it gets long"), undefined);
  assert.equal(SlashCommand.parse("/"), undefined);
});

test("a command that draws a screen is refused as typed, and bare only when it has no arguments", () => {
  assert.equal(SlashCommand.needsTerminal({ screen: "always" }, "all"), true);
  assert.equal(SlashCommand.needsTerminal({ screen: "bare" }, ""), true);
  assert.equal(SlashCommand.needsTerminal({ screen: "bare" }, "theme=dark"), false);
  assert.equal(SlashCommand.needsTerminal({}, ""), false);
});
