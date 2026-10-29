import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node } from "comark";
import { SuggestedCommand } from "./suggested-command.ts";

test("a block whose first line starts with ! runs its ! lines without the mark, one shell line each", () => {
  assert.equal(SuggestedCommand.of("! git status\n"), "git status");
  assert.equal(
    SuggestedCommand.of("\n! cd ~/mcp && git push -u origin feature/x"),
    "cd ~/mcp && git push -u origin feature/x",
  );
  assert.equal(SuggestedCommand.of("! pnpm install\n! pnpm test\nnot a command"), "pnpm install\npnpm test");
});

test("code that merely has a ! in it is not a command to run", () => {
  for (const text of ["git status", "!isReady", "!== 1", "!", "! ", "git status\n! ls", ""])
    assert.equal(SuggestedCommand.of(text), undefined, JSON.stringify(text));
});

test("a code span in running text carries its command, while a fence and a link keep their code", () => {
  const code = (text: string): Node => ["code", {}, text];
  const fence: Node = ["pre", {}, code("! rm -rf build")];
  const link: Node = ["a", { href: "/x" }, code("! ls")];
  assert.deepEqual(
    SuggestedCommand.withRefs([["p", {}, "Run ", code("! git push"), " or ", code("git pull"), fence, link]]),
    [
      [
        "p",
        {},
        "Run ",
        ["command-ref", { command: "git push" }, code("! git push")],
        " or ",
        code("git pull"),
        fence,
        link,
      ],
    ],
  );
});
