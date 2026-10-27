import assert from "node:assert/strict";
import test from "node:test";
import { Markdown } from "./index.ts";

test("a fenced code block is syntax highlighted, by its fence language", async () => {
  const html = await Markdown.body("```python\ndef f(x):\n    return x\n```");
  assert.match(html, /class="shj-syn-kwd">def</);
  assert.match(html, /<code class="language-python">/);
});

test("a highlighted fence still escapes HTML-sensitive characters in the code", async () => {
  const html = await Markdown.body('```js\nif (a < b) { return "<x>" }\n```');
  assert.match(html, /&lt;x&gt;/);
  assert.doesNotMatch(html, /<x>/);
});

test("a mermaid fence is drawn as an svg whose block holds labels, with its CSS after the sections", async () => {
  const html = await Markdown.body(
    "```mermaid\nflowchart LR\n  A[add Tesla<br/>to my watchlist] -- yes --> B{empty?}\n```",
  );
  const block = html.slice(html.indexOf('<div class="diagram"'), html.indexOf("</section>"));
  assert.match(block, /<svg [^>]*--bg:var\(--page-bg\)/);
  assert.match(block, /add Tesla/);
  assert.doesNotMatch(block, /<style/);
  assert.match(html, /<\/section>\n<style>[^<]*--_text/);
  assert.doesNotMatch(html, /googleapis/);
});

test("front matter that is not valid YAML is dropped and the body still draws", async () => {
  const html = await Markdown.body("---\ndescription: A mode: a thing\n---\n\n# Title\n\nBody text.");
  assert.match(html, /<h1[^>]*>Title<\/h1>/);
  assert.match(html, /Body text\./);
  assert.doesNotMatch(html, /A mode/);
});

const PROPOSAL =
  '<del data-sc-edit="0123456789ab">\n\nThe **old** way.\n\n</del>\n<ins data-sc-edit="0123456789ab">\n\nThe new way.\n\n</ins>';

test("a pending proposal draws its old and new paragraph as a del and ins pair, and one quoted in a fence stays code", async () => {
  const html = await Markdown.body(`Intro.\n\n${PROPOSAL}\n\nOutro.`);
  assert.match(
    html,
    /<p>Intro\.<\/p><del data-sc-edit="0123456789ab"><p>The <strong>old<\/strong> way\.<\/p><\/del><ins data-sc-edit="0123456789ab"><p>The new way\.<\/p><\/ins><p>Outro\.<\/p>/,
  );
  assert.doesNotMatch(await Markdown.body(`\`\`\`md\n${PROPOSAL}\n\`\`\``), /<del/);
});

test("a paragraph holding only a pasted upload is drawn as a figure with its name and a preview link", async () => {
  const html = await Markdown.body("![a shot](../uploads/plan/pasted-1432.png)\n\nand ![inline](other.png) stays");
  assert.match(
    html,
    /<figure class="pasted"><img src="\.\.\/uploads\/plan\/pasted-1432\.png" alt="a shot"><figcaption><span>a shot<\/span><span class="name">pasted · pasted-1432\.png<\/span><a class="preview" href="\.\.\/uploads\/plan\/pasted-1432\.png" target="_blank" rel="noopener">Preview<\/a><\/figcaption><\/figure>/,
  );
  assert.match(html, /<img src="other\.png" alt="inline">/);
});

test("a task drops its h1 and turns the impact list into cards, a bracketed number waiting on data and counted in the heading", async () => {
  const markdown =
    "<!-- artifact\nstate: running\n-->\n# Fix login\n\n## Why\n\nText.\n\n## Impact\n\n- **[N]** users locked out\n- **12** minutes saved\n- plain\n";
  const page = await Markdown.page({ markdown, task: { state: "running" }, title: "Fix login" });
  const body = page.slice(page.indexOf("<body>"));
  assert.match(body, /<main class="page" data-task="running">/);
  assert.doesNotMatch(body, /<h1/);
  assert.match(body, /<h2 id="impact" data-needs-data="1 number needs data">Impact<\/h2>/);
  assert.match(
    body,
    /<ul class="impact"><li class="card" data-waiting><strong>\[N\]<\/strong> users locked out<\/li><li class="card"><strong>12<\/strong> minutes saved<\/li><li>plain<\/li><\/ul>/,
  );
  const plain = await Markdown.body(markdown);
  assert.match(plain, /<h1/);
  assert.doesNotMatch(plain, /class="impact"/);
});

test("a mermaid type the renderer cannot draw keeps its fenced source", async () => {
  const html = await Markdown.body('```mermaid\npie title Pets\n  "Dogs" : 386\n```');
  assert.match(html, /<code class="language-mermaid">/);
  assert.doesNotMatch(html, /<svg/);
});
