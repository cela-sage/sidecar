import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { ArtifactLists } from "../../../lib/sidecar/lists.ts";
import * as Events from "../../../lib/sidecar/events.ts";
import { Tracked } from "../../../lib/sidecar/tracked.ts";
import { readRecord, removeRecord } from "../../../lib/web/records.ts";
import { artifactsOf, Documents } from "./artifact-lists.ts";
import { conversationOf } from "./conversation.ts";
import { Links } from "./links.ts";

let root: string;
let restore: () => void;

before(() => {
  root = mkdtempSync(join(tmpdir(), "sidecar-links-"));
  const had = "CLAUDE_CONFIG_DIR" in process.env;
  const was = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = root;
  restore = () => (had ? (process.env.CLAUDE_CONFIG_DIR = was ?? "") : delete process.env.CLAUDE_CONFIG_DIR);
});

after(() => {
  restore();
  rmSync(root, { recursive: true, force: true });
});

const at = (s: number): string => `2026-01-01T09:00:0${s}.000Z`;
const user = (s: number, content: string) => ({ type: "user", timestamp: at(s), message: { role: "user", content } });
const assistant = (s: number, content: Record<string, unknown>[]) => ({
  type: "assistant",
  timestamp: at(s),
  message: { role: "assistant", content },
});
const said = (s: number, text: string) => assistant(s, [{ type: "text", text }]);
const called = (s: number, id: string, name: string, input: Record<string, unknown>) =>
  assistant(s, [{ type: "tool_use", id, name, input }]);
const ended = (s: number) => ({ type: "system", subtype: "turn_duration", timestamp: at(s) });
const lines = (...entries: Record<string, unknown>[]): string =>
  entries.map((one) => `${JSON.stringify(one)}\n`).join("");
const listed = (key: string): string[] =>
  ArtifactLists.entries(key).map((slug) => readRecord(slug)?.url ?? Tracked.paths().get(slug) ?? slug);
const offsets = new Map<string, number>();
const grow = (key: string, path: string): void => {
  const slice = conversationOf({ key, path, since: offsets.get(key) ?? 0 });
  offsets.set(key, slice.offset);
  Links.adopt({ key, path, ...slice, isLive: true });
};
const touch = (path: string): string => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "");
  return path;
};

test("reads every address in prose, trimming what the sentence or markdown wrapped around it, and none in code", () => {
  const text = [
    "See [the MR](https://gitlab.com/a/b/-/merge_requests/7) and https://example.com/docs.",
    "**https://bold.dev/x**, (https://en.wikipedia.org/wiki/Foo_(bar)) and <https://angle.io/y>",
    "`https://inline.dev` and https://example.com/docs again",
    "```",
    "curl https://fenced.dev/api",
    "```",
  ].join("\n");
  assert.deepEqual(Links.of(text), [
    "https://gitlab.com/a/b/-/merge_requests/7",
    "https://example.com/docs",
    "https://bold.dev/x",
    "https://en.wikipedia.org/wiki/Foo_(bar)",
    "https://angle.io/y",
  ]);
});

test("a turn lists what it hands over: the reply once the turn ends and a message's links and pages, never narration, sources or a named rule", () => {
  const key = "abcdef12";
  const home = realpathSync(root);
  const rule = touch(join(home, "notes", "CLAUDE.md"));
  const plan = touch(join(home, "notes", "plan.md"));
  const page = touch(join(home, "sidecar", "artifacts", "brief.md"));
  const path = join(root, "projects", "-tmp-links", `${key}-1111-2222-3333-444444444444.jsonl`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    lines(
      user(1, `read ${rule} first, then https://github.com/a/b and ${page}`),
      said(2, `reading ${rule}`),
      said(3, `the plan is at \`${plan}\`, and https://docs.dev/x has the rest`),
    ),
  );
  const events = Events.end();

  grow(key, path);
  assert.deepEqual(listed(key), ["https://github.com/a/b", "brief"]);

  appendFileSync(path, lines(ended(4)));
  grow(key, path);
  assert.deepEqual(listed(key), ["https://github.com/a/b", "brief", "https://docs.dev/x", plan]);

  const [removed = ""] = ArtifactLists.entries(key);
  removeRecord(removed);
  appendFileSync(
    path,
    lines(
      user(5, "find sources, like https://github.com/a/b"),
      called(6, "s1", "WebSearch", { query: "chrome storage" }),
      said(7, "Sources:\n- [A](https://found.dev/a)"),
      ended(8),
    ),
  );
  grow(key, path);
  assert.deepEqual(listed(key), [removed, "brief", "https://docs.dev/x", plan]);
  assert.deepEqual(
    Events.read(events).events.map((event) => event.data.title),
    ["github.com", "docs.dev", "plan.md"],
  );
});

test("a catch-up up to a byte lands quietly, and only what was said after it is announced", () => {
  const key = "fedcba98";
  const path = join(root, "projects", "-tmp-links", `${key}-1111-2222-3333-444444444444.jsonl`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lines(said(1, "before https://old.dev"), ended(2)));
  const until = statSync(path).size;
  appendFileSync(path, lines(said(3, "now https://now.dev"), ended(4)));
  const events = Events.end();

  Links.catchUp({ key, path, until });
  Links.catchUp({ key, path, until });
  offsets.set(key, until);
  grow(key, path);

  assert.deepEqual(listed(key), ["https://old.dev/", "https://now.dev/"]);
  assert.deepEqual(
    Events.read(events).events.map((event) => event.data.title),
    ["now.dev"],
  );
});

test("a .md recorded under a job's folder is scratch, so it lists neither as a document nor in the conversation", () => {
  const key = "abcd1234";
  const scratch = touch(join(root, "jobs", "e2f70a46", "tmp", "scratch", "sidecar-task-board.md"));
  const real = touch(join(root, "docs", "real-plan.md"));
  writeFileSync(join(root, "artifacts", `session-${key}`), `${real}\n${scratch}\n`);

  assert.deepEqual([...Documents.paths().values()].sort(), [real]);
  assert.deepEqual(artifactsOf(key), [Documents.slug(real)]);
});
