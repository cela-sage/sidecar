import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { Pasted } from "./pasted.ts";

const KEY = "dddddddd";
const SHOT = "/private/tmp/claude-501/-tmp-delta/dddddddd/images/2.png";
const NEXT = "/private/tmp/claude-501/-tmp-delta/dddddddd/images/3.png";
const NAKED = "/private/tmp/claude-501/-tmp-delta/dddddddd/images/4.png";

const base64 = (text: string): string => Buffer.from(text).toString("base64");

let root: string;
let restore: () => void;

before(() => {
  root = mkdtempSync(join(tmpdir(), "sidecar-pasted-"));
  const had = "CLAUDE_CONFIG_DIR" in process.env;
  const was = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = root;
  restore = () => (had ? (process.env.CLAUDE_CONFIG_DIR = was ?? "") : delete process.env.CLAUDE_CONFIG_DIR);
  const lines = [
    {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: `[Image: source: /etc/passwd]` }] },
    },
    {
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "text", text: "[Image #2] [Image #3] mind the window" },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64("pixels") } },
          { type: "image", source: { type: "base64", media_type: "image/png", data: base64("more") } },
        ],
      },
    },
    {
      type: "user",
      isMeta: true,
      message: {
        role: "user",
        content: [
          { type: "text", text: `[Image: source: ${SHOT}]` },
          { type: "text", text: `[Image: source: ${NEXT}]` },
        ],
      },
    },
    { type: "user", message: { role: "user", content: [{ type: "text", text: `[Image: source: ${NAKED}]` }] } },
  ];
  const dir = join(root, "projects", "-tmp-delta");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${KEY}-1111-2222-3333-444444444444.jsonl`),
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
  );
});

after(() => {
  restore();
  rmSync(root, { recursive: true, force: true });
});

test("each source line takes the picture sent in its place, so the file can be served after it is gone", () => {
  const first = Pasted.find({ key: KEY, path: SHOT });
  const next = Pasted.find({ key: KEY, path: NEXT });
  assert.deepEqual([first?.type, first?.bytes?.toString()], ["image/jpeg", "pixels"]);
  assert.deepEqual([next?.type, next?.bytes?.toString()], ["image/png", "more"]);
});

test("a path the conversation names without a picture is known but has no bytes", () => {
  assert.deepEqual(Pasted.find({ key: KEY, path: NAKED }), { path: NAKED, type: undefined, bytes: undefined });
});

test("only a path a user message handed over is found, never one an assistant wrote", () => {
  assert.equal(Pasted.find({ key: KEY, path: "/etc/passwd" }), undefined);
  assert.equal(Pasted.find({ key: "eeeeeeee", path: SHOT }), undefined);
});
