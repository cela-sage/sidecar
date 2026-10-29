import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { Mentioned } from "./mentioned.ts";

const KEY = "dddddddd";
const NAMED = "/srv/notes/plan.md";
const LATER = "/srv/notes/later.md";
const SENT = "/srv/up/shot.png";

let root: string;
let transcript: string;
let restore: () => void;

const turn = (role: "user" | "assistant", content: unknown, at: number): string =>
  JSON.stringify({
    type: role,
    timestamp: `2026-10-29T09:00:0${at}.000Z`,
    message: { role, content },
  });

before(() => {
  root = mkdtempSync(join(tmpdir(), "sidecar-mentioned-"));
  const had = "CLAUDE_CONFIG_DIR" in process.env;
  const was = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = root;
  restore = () => (had ? (process.env.CLAUDE_CONFIG_DIR = was ?? "") : delete process.env.CLAUDE_CONFIG_DIR);
  const dir = join(root, "projects", "-tmp-delta");
  mkdirSync(dir, { recursive: true });
  transcript = join(dir, `${KEY}-1111-2222-3333-444444444444.jsonl`);
  writeFileSync(
    transcript,
    `${[
      turn(
        "user",
        `Another Claude session sent a message: [[sidecar]]\nwhy?\n\nAttached: ${SENT}\n\nThis came from another Claude session`,
        1,
      ),
      turn("assistant", [{ type: "text", text: `I wrote \`${NAMED}\`. Also ~/kept.md and /srv/notes/plan.md.bak` }], 2),
      turn("assistant", [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "cat /srv/secret.md" } }], 3),
    ].join("\n")}\n`,
  );
});

after(() => {
  restore();
  rmSync(root, { recursive: true, force: true });
});

test("a path a reply names is readable, with a full stop after it or in its home form", () => {
  assert.equal(Mentioned.has({ key: KEY, path: NAMED }), true);
  assert.equal(Mentioned.has({ key: KEY, path: SENT }), true);
  assert.equal(Mentioned.has({ key: KEY, path: join(homedir(), "kept.md") }), true);
});

test("a longer path, a suffix on the name, a tool's argument or another conversation never name it", () => {
  assert.equal(Mentioned.has({ key: KEY, path: "/notes/plan.md" }), false);
  assert.equal(Mentioned.has({ key: KEY, path: "/srv/notes/plan" }), false);
  assert.equal(Mentioned.has({ key: KEY, path: "/srv/secret.md" }), false);
  assert.equal(Mentioned.has({ key: "eeeeeeee", path: NAMED }), false);
});

test("a path named after the first ask is found without reading the transcript again from the start", () => {
  assert.equal(Mentioned.has({ key: KEY, path: LATER }), false);
  appendFileSync(transcript, `${turn("assistant", [{ type: "text", text: `Now ${LATER}` }], 4)}\n`);
  assert.equal(Mentioned.has({ key: KEY, path: LATER }), true);
  assert.equal(Mentioned.has({ key: KEY, path: NAMED }), true);
});
