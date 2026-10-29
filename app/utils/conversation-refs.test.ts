import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node } from "comark";
import { ConversationRefs } from "./conversation-refs.ts";
import { MediaRefs } from "./media-refs.ts";

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

test("a key alone in backticks becomes the chip around its code, and any other code stays code", () => {
  const nodes = ConversationRefs.withRefs([
    ["p", {}, "ask ", ["code", {}, "70ef962c"], " not ", ["code", {}, "70ef962cab"], " or ", ["code", {}, "git 70ef962c"]],
  ]);
  assert.deepEqual(nodes, [
    [
      "p",
      {},
      "ask ",
      ["conversation-ref", { conversation: "70ef962c" }, ["code", {}, "70ef962c"]],
      " not ",
      ["code", {}, "70ef962cab"],
      " or ",
      ["code", {}, "git 70ef962c"],
    ],
  ]);
});

test("a title in backticks becomes the chip of the conversation that has it, and an unknown one stays code", () => {
  const titles = new Map([["[meta] PL conversation rename", "a6569a05"]]);
  const known: Node = ["code", {}, "[meta] PL conversation rename"];
  assert.deepEqual(ConversationRefs.withRefs([["p", {}, known, ["code", {}, "[meta] PL other"]]], titles), [
    ["p", {}, ["conversation-ref", { conversation: "a6569a05" }, known], ["code", {}, "[meta] PL other"]],
  ]);
  assert.deepEqual(ConversationRefs.withRefs([["p", {}, known]]), [["p", {}, known]]);
});

test("a media path in backticks links in place and renders under its paragraph, once each and in order", () => {
  const nodes = MediaRefs.withMedia([
    ["p", {}, "see ", ["code", {}, "docs/a.mp4"], " and ", ["code", {}, "b.svg"], " and ", ["code", {}, "a.ts"]],
    ["ul", {}, ["li", {}, "again ", ["code", {}, "docs/a.mp4"]]],
  ]);
  assert.deepEqual(nodes, [
    [
      "p",
      {},
      "see ",
      ["media-ref", { path: "docs/a.mp4" }, "docs/a.mp4"],
      " and ",
      ["media-ref", { path: "b.svg" }, "b.svg"],
      " and ",
      ["code", {}, "a.ts"],
    ],
    ["media-set", { paths: "docs/a.mp4\nb.svg" }],
    [
      "ul",
      {},
      ["li", {}, "again ", ["media-ref", { path: "docs/a.mp4" }, "docs/a.mp4"], ["media-set", { paths: "docs/a.mp4" }]],
    ],
  ]);
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
