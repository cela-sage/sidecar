import assert from "node:assert/strict";
import { test } from "node:test";
import { ConversationRefs } from "./conversation-refs.ts";

const keysOf = (text: string): string[] => ConversationRefs.of(text).map((one) => one.key);

test("a conversation reads as @<key> or as the door's @<title> (<key>), resolved by its key", () => {
  assert.deepEqual(keysOf("ask @70ef962c about it"), ["70ef962c"]);
  assert.deepEqual(keysOf("@[Cela] PL sidecar-task-board plan (70ef962c) and @cded5e9d."), ["70ef962c", "cded5e9d"]);
  const [long] = ConversationRefs.of("see @[Cela] PL plan (70ef962c) now");
  assert.deepEqual("see @[Cela] PL plan (70ef962c) now".slice(long?.start, long?.end), "@[Cela] PL plan (70ef962c)");
});

test("a bare key, a git hash, an e-mail or a longer hex never reads as a conversation", () => {
  assert.deepEqual(keysOf("commit 70ef962c landed"), []);
  assert.deepEqual(keysOf("mail me@70ef962c.dev"), []);
  assert.deepEqual(keysOf("@70ef962cab is a hash"), []);
  assert.deepEqual(keysOf("@70ef962c-fix is a branch"), []);
});

test("a ref inside code, a link or a line ref stays as it is, and text around it splits", () => {
  const nodes = ConversationRefs.withRefs([
    ["p", {}, "ping @70ef962c then ", ["code", {}, "@cded5e9d"], " and ", ["a", { href: "x" }, "@cded5e9d"]],
  ]);
  assert.deepEqual(nodes, [
    [
      "p",
      {},
      "ping ",
      ["conversation-ref", { conversation: "70ef962c" }, "@70ef962c"],
      " then ",
      ["code", {}, "@cded5e9d"],
      " and ",
      ["a", { href: "x" }, "@cded5e9d"],
    ],
  ]);
});
