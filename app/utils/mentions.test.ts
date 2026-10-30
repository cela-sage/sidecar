import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const style = readFileSync(new URL("../components/composer/input.vue", import.meta.url), "utf8")
  .match(/<style scoped>([\s\S]*?)<\/style>/)?.[1]
  ?.replace(/\/\*[\s\S]*?\*\//g, "");

const rulesOf = (selector: string): string[] =>
  [...(style ?? "").matchAll(/(?:^|\n)([^{}\n][^{}]*)\{([^}]*)\}/g)]
    .filter(([, selectors = ""]) => selectors.split(",").some((one) => one.trim() === selector))
    .flatMap(
      ([, , body = ""]) =>
        body
          .match(/@apply\s+([^;]+);/)?.[1]
          ?.trim()
          .split(/\s+/) ?? [],
    );

const WIDTH =
  /^(?:font-|tracking-|typo-|italic$|text-(?:xs|sm|base|lg|\d?xl)$|-?[pm][xylrtbse]?-|border|w-|min-w-|max-w-|gap-|indent-)/;

test("the copy under the textarea draws its text in the textarea's type, so the caret sits where the text shows", () => {
  const shared = new Set(rulesOf(".mirror").filter((one) => rulesOf(".box").includes(one)));
  for (const type of [
    "font-sans",
    "typo-body",
    "leading-normal",
    "break-words",
    "whitespace-pre-wrap",
    "p-0",
    "border-0",
  ]) {
    assert.ok(shared.has(type), `${type} is set on the mirror and the textarea alike`);
  }
});

test("a mention or a file piece shows through tint and colour alone, since a wider glyph wraps the copy earlier than the textarea", () => {
  for (const mark of [".mention", ".file", ".at"]) {
    const tokens = rulesOf(mark);
    assert.ok(tokens.length, `${mark} has a rule`);
    assert.deepEqual(
      tokens.filter((one) => WIDTH.test(one)),
      [],
      `${mark} changes nothing that sets a glyph's width`,
    );
  }
});
