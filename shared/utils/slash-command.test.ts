import assert from "node:assert/strict";
import { test } from "node:test";
import { SlashCommand } from "./slash-command.ts";

test("a slash and a name open a command, and the rest of the text is its arguments", () => {
  assert.deepEqual(SlashCommand.parse("/compact"), { name: "compact", args: "" });
  assert.deepEqual(SlashCommand.parse("  /mode:ic  new glass\nfor the nav "), {
    name: "mode:ic",
    args: "new glass\nfor the nav",
  });
  assert.equal(SlashCommand.line({ name: "style", args: "edu" }), "/style edu");
  assert.equal(SlashCommand.line({ name: "compact", args: "" }), "/compact");
});

test("a path or a slash later in the text is a message", () => {
  assert.equal(SlashCommand.parse("/Users/madong/Notes"), undefined);
  assert.equal(SlashCommand.parse("//comment"), undefined);
  assert.equal(SlashCommand.parse("run /compact when it gets long"), undefined);
  assert.equal(SlashCommand.parse("/"), undefined);
});

test("the menu opens on a lone slash and closes once a space or a second slash follows", () => {
  assert.deepEqual(SlashCommand.typing("/"), { query: "" });
  assert.deepEqual(SlashCommand.typing("/mode:i"), { query: "mode:i" });
  assert.equal(SlashCommand.typing("/compact "), undefined);
  assert.equal(SlashCommand.typing("/Users/me"), undefined);
  assert.equal(SlashCommand.typing("say /compact"), undefined);
});

test("typing after the slash lists the names that start with it first, then the ones that contain it", () => {
  const list = ["batch", "decode", "compact", "context"].map((name) => ({
    name,
    description: "",
    source: "builtin" as const,
  }));
  assert.deepEqual(
    SlashCommand.matching(list, "co").map((one) => one.name),
    ["compact", "context", "decode"],
  );
  assert.deepEqual(
    SlashCommand.matching(list, "").map((one) => one.name),
    ["batch", "decode", "compact", "context"],
  );
  assert.deepEqual(SlashCommand.matching(list, "zz"), []);
});

test("a row says where its command comes from, and a builtin says nothing", () => {
  assert.equal(SlashCommand.tagOf({ source: "builtin" }), undefined);
  assert.equal(SlashCommand.tagOf({ source: "user" }), "user");
  assert.equal(SlashCommand.tagOf({ source: "mcp" }), "mcp");
  assert.equal(SlashCommand.tagOf({ source: "plugin", plugin: "mode" }), "mode");
  assert.equal(SlashCommand.tagOf({ source: "plugin" }), "plugin");
});

test("a command that draws a screen is refused as typed, and bare only when it has no arguments", () => {
  assert.equal(SlashCommand.needsTerminal({ screen: "always" }, "all"), true);
  assert.equal(SlashCommand.needsTerminal({ screen: "bare" }, ""), true);
  assert.equal(SlashCommand.needsTerminal({ screen: "bare" }, "theme=dark"), false);
  assert.equal(SlashCommand.needsTerminal({}, ""), false);
});
