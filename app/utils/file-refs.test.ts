import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node } from "comark";
import { FileRefs } from "./file-refs.ts";

const pathsIn = (text: string): string[] => FileRefs.of(text).map((one) => one.path);

test("a path in running text is found with its full stop left out, and a URL, a fraction or a relative path is not one", () => {
  assert.deepEqual(pathsIn("wrote /Users/me/.claude/sidecar/artifacts/plan.md. Also ~/Notes/a-b.txt, then"), [
    "/Users/me/.claude/sidecar/artifacts/plan.md",
    "~/Notes/a-b.txt",
  ]);
  assert.deepEqual(pathsIn("see https://example.com/a/b.png or example.com/c.png or 3/4.5 or ./src/x.ts"), []);
});

test("a path in backticks becomes a file chip around its code, and a property or a version stays code", () => {
  const code = (text: string): Node => ["code", {}, text];
  const nodes = FileRefs.withRefs([
    [
      "p",
      {},
      code("src/menu.ts"),
      " ",
      code("package.json"),
      " ",
      code("user.name"),
      " ",
      code("v1.2.3"),
      " ",
      code("a.b/c"),
    ],
  ]);
  assert.deepEqual(nodes, [
    [
      "p",
      {},
      ["file-ref", { path: "src/menu.ts" }, code("src/menu.ts")],
      " ",
      ["file-ref", { path: "package.json" }, code("package.json")],
      " ",
      code("user.name"),
      " ",
      code("v1.2.3"),
      " ",
      code("a.b/c"),
    ],
  ]);
});

test("a link, a fence and a chip already drawn keep their text, and a bare path around them still splits", () => {
  const kept: Node[] = [
    ["a", { href: "/x/y.md" }, "/x/y.md"],
    ["pre", {}, ["code", {}, "/x/y.md"]],
    ["media-ref", { path: "/x/y.png" }, "/x/y.png"],
  ];
  assert.deepEqual(FileRefs.withRefs([["p", {}, ...kept, " and /x/z.md"]]), [
    ["p", {}, ...kept, " and ", ["file-ref", { path: "/x/z.md" }, "/x/z.md"]],
  ]);
});

test("a path is made absolute against the working directory, and ~ against the home the directory sits in", () => {
  const cwd = "/Users/me/Notes/projects/Cela";
  assert.equal(FileRefs.absolute({ path: "/etc/a.md", cwd }), "/etc/a.md");
  assert.equal(FileRefs.absolute({ path: "src/menu.ts", cwd }), `${cwd}/src/menu.ts`);
  assert.equal(FileRefs.absolute({ path: "../x/y.md", cwd }), "/Users/me/Notes/projects/x/y.md");
  assert.equal(FileRefs.absolute({ path: "~/Notes/a.md", cwd }), "/Users/me/Notes/a.md");
  assert.equal(FileRefs.absolute({ path: "src/menu.ts" }), undefined);
});
