import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { conversationOf } from "./conversation.ts";

let root: string;
let restore: () => void;

before(() => {
  root = mkdtempSync(join(tmpdir(), "sidecar-conversation-"));
  const had = "CLAUDE_CONFIG_DIR" in process.env;
  const was = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = root;
  restore = () => (had ? (process.env.CLAUDE_CONFIG_DIR = was ?? "") : delete process.env.CLAUDE_CONFIG_DIR);
});

after(() => {
  restore();
  rmSync(root, { recursive: true, force: true });
});

function writeTranscript(key: string, slug: string, lines: Record<string, unknown>[]): void {
  const dir = join(root, "projects", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${key}-1111-2222-3333-444444444444.jsonl`),
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
  );
}

test("a compact summary is a bare note, never the huge body it carries", () => {
  const key = "cccccccc";
  writeTranscript(key, "-tmp-gamma", [
    {
      type: "user",
      cwd: "/tmp/gamma",
      timestamp: "2026-01-01T09:00:00.000Z",
      message: { role: "user", content: "before" },
    },
    {
      type: "user",
      cwd: "/tmp/gamma",
      isCompactSummary: true,
      isVisibleInTranscriptOnly: true,
      timestamp: "2026-01-01T09:00:01.000Z",
      message: { role: "user", content: "x".repeat(28000) },
    },
    {
      type: "user",
      cwd: "/tmp/gamma",
      timestamp: "2026-01-01T09:00:02.000Z",
      message: { role: "user", content: "after" },
    },
  ]);

  const { turns } = conversationOf({ key });
  assert.deepEqual(
    turns.map((turn) => ({ role: turn.role, text: turn.text, kind: turn.kind })),
    [
      { role: "user", text: "before", kind: undefined },
      { role: "system", text: "Compacted", kind: "note" },
      { role: "user", text: "after", kind: undefined },
    ],
  );
});

test("a tool result pairs back to its call by id, carrying the tool name a bare result lacks", () => {
  const key = "eeeeeeee";
  writeTranscript(key, "-tmp-delta2", [
    {
      type: "assistant",
      cwd: "/tmp/delta2",
      timestamp: "2026-01-01T09:00:00.000Z",
      message: {
        role: "assistant",
        content: [
          { type: "tool_use", id: "toolu_bg1", name: "Bash", input: { command: "sleep 30", run_in_background: true } },
        ],
      },
    },
    {
      type: "user",
      cwd: "/tmp/delta2",
      timestamp: "2026-01-01T09:00:31.000Z",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_bg1", content: "done" }] },
    },
  ]);

  const { turns } = conversationOf({ key });
  assert.deepEqual(
    turns.map((turn) => ({ role: turn.role, kind: turn.kind, tool: turn.tool, ref: turn.ref, bg: turn.bg })),
    [
      { role: "assistant", kind: "acting", tool: "Bash", ref: "toolu_bg1", bg: true },
      { role: "system", kind: "done", tool: "Bash", ref: "toolu_bg1", bg: undefined },
    ],
  );
});

test("a foreground call carries no bg flag", () => {
  const key = "ffffffff";
  writeTranscript(key, "-tmp-delta3", [
    {
      type: "assistant",
      cwd: "/tmp/delta3",
      timestamp: "2026-01-01T09:00:00.000Z",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "toolu_fg1", name: "Read", input: { file_path: "/tmp/x" } }],
      },
    },
  ]);

  const { turns } = conversationOf({ key });
  assert.equal(turns[0]?.bg, undefined);
});

test("a question carries its options, so the chat can offer them instead of an opaque tool row", () => {
  const key = "eeeeeeee";
  writeTranscript(key, "-tmp-delta4", [
    {
      type: "assistant",
      cwd: "/tmp/delta4",
      timestamp: "2026-01-01T09:00:00.000Z",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_ask1",
            name: "AskUserQuestion",
            input: {
              questions: [
                {
                  question: "Which binding?",
                  header: "Binding",
                  multiSelect: true,
                  options: [{ label: "Hold C", description: "the original" }, { label: "Hold Option" }],
                },
              ],
            },
          },
        ],
      },
    },
  ]);

  const [turn] = conversationOf({ key }).turns;
  assert.equal(turn?.arg, "Which binding?");
  assert.deepEqual(turn?.ask, [
    {
      question: "Which binding?",
      header: "Binding",
      multi: true,
      options: [
        { label: "Hold C", description: "the original" },
        { label: "Hold Option", description: undefined },
      ],
    },
  ]);
});

test("the permission mode a person's side wrote rides on its turns, so the chat can show the session's mode", () => {
  const key = "dddddddd";
  writeTranscript(key, "-tmp-mode", [
    {
      type: "user",
      permissionMode: "acceptEdits",
      timestamp: "2026-01-01T09:00:00.000Z",
      message: { role: "user", content: "go" },
    },
    {
      type: "user",
      permissionMode: "plan",
      timestamp: "2026-01-01T09:00:02.000Z",
      toolUseResult: { stdout: "ok" },
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }] },
    },
    {
      type: "assistant",
      timestamp: "2026-01-01T09:00:03.000Z",
      message: { role: "assistant", content: [{ type: "text", text: "done" }] },
    },
  ]);

  const { turns } = conversationOf({ key });
  assert.deepEqual(
    turns.map((turn) => turn.mode),
    ["acceptEdits", "plan", undefined],
  );
});

test("a tool that is not a question carries no ask", () => {
  const key = "dddddddd";
  writeTranscript(key, "-tmp-delta5", [
    {
      type: "assistant",
      cwd: "/tmp/delta5",
      timestamp: "2026-01-01T09:00:00.000Z",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "toolu_r1", name: "Read", input: { file_path: "/tmp/x" } }],
      },
    },
  ]);

  assert.equal(conversationOf({ key }).turns[0]?.ask, undefined);
});

test("a call carries what the chat unfolds, and its result the diff or the output, never a read's file", () => {
  const key = "abababab";
  const at = (second: number): string => `2026-01-01T09:00:0${second}.000Z`;
  const result = (id: string, second: number, extra: Record<string, unknown>): Record<string, unknown> => ({
    type: "user",
    cwd: "/tmp/eps",
    timestamp: at(second),
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok", ...extra }] },
  });
  writeTranscript(key, "-tmp-eps", [
    {
      type: "user",
      cwd: "/tmp/eps",
      origin: { kind: "human" },
      timestamp: at(0),
      message: { role: "user", content: "rename it" },
    },
    {
      type: "assistant",
      cwd: "/tmp/eps",
      timestamp: at(1),
      message: {
        role: "assistant",
        model: "claude-opus-5-5",
        content: [{ type: "tool_use", id: "t_read", name: "Read", input: { file_path: "/tmp/eps/a.ts", offset: 3, limit: 5 } }],
      },
    },
    { ...result("t_read", 2, {}), toolUseResult: { type: "text", file: { filePath: "/tmp/eps/a.ts" } } },
    {
      type: "assistant",
      cwd: "/tmp/eps",
      timestamp: at(3),
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "t_edit", name: "Edit", input: { file_path: "/tmp/eps/a.ts" } }],
      },
    },
    {
      ...result("t_edit", 4, {}),
      toolUseResult: { structuredPatch: [{ oldStart: 4, newStart: 4, lines: [" a", "-b", "+c", "+d"] }] },
    },
    {
      type: "assistant",
      cwd: "/tmp/eps",
      timestamp: at(5),
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "t_run", name: "Bash", input: { command: "pnpm test" } }],
      },
    },
    result("t_run", 6, { content: "1 failed", is_error: true }),
  ]);

  const turns = conversationOf({ key }).turns;
  assert.equal(turns[0]?.via, "terminal");
  assert.deepEqual(turns[1]?.call, { kind: "read", path: "/tmp/eps/a.ts", from: 3, to: 7 });
  assert.equal(turns[1]?.model, "claude-opus-5-5");
  assert.equal(turns[2]?.out, undefined);
  assert.deepEqual(turns[4]?.diff, { add: 2, del: 1, hunks: [{ oldStart: 4, newStart: 4, lines: [" a", "-b", "+c", "+d"] }] });
  assert.deepEqual(
    { call: turns[5]?.call, out: turns[6]?.out, failed: turns[6]?.failed },
    { call: { kind: "run", command: "pnpm test" }, out: "1 failed", failed: true },
  );
});

test("a command draws as its line and what it printed, and the context the harness adds around it stays out", () => {
  const key = "ffffffff";
  const user = (second: number, content: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    type: "user",
    cwd: "/tmp/cmd",
    timestamp: `2026-01-01T09:00:0${second}.000Z`,
    message: { role: "user", content },
    ...extra,
  });
  writeTranscript(key, "-tmp-cmd", [
    user(0, "<local-command-caveat>Caveat: generated while running local commands.</local-command-caveat>", { isMeta: true }),
    user(1, "<command-name>/compact</command-name>\n   <command-message>compact</command-message>\n   <command-args></command-args>"),
    user(2, "<local-command-stdout>\u001b[2mCompacted (ctrl+o to see full summary)\u001b[22m</local-command-stdout>"),
    user(3, "<command-message>mode:ic</command-message>\n<command-name>/mode:ic</command-name>\n<command-args>new glass</command-args>"),
    user(4, [{ type: "text", text: "Base directory for this skill: /tmp/skills/ic\n\n# IC" }], { isMeta: true, turnCompanion: true }),
    user(4, [{ type: "text", text: "Base directory for this skill: /tmp/skills/ic" }], { isMeta: true, sourceToolUseID: "toolu_1" }),
    {
      type: "system",
      subtype: "local_command",
      timestamp: "2026-01-01T09:00:05.000Z",
      content: "<local-command-stdout>sidecar: up at http://sidecar.localhost:4747</local-command-stdout>",
    },
    user(6, "Another Claude session sent a message:\nship it", { isMeta: true, origin: { kind: "peer" } }),
    user(7, [{ type: "text", text: "[Image: source: /tmp/cmd/1.png]" }], { isMeta: true }),
    {
      type: "system",
      subtype: "informational",
      timestamp: "2026-01-01T09:00:08.000Z",
      content: "<command-name>/foo</command-name>\n<command-message>foo</command-message>\n<command-args></command-args>",
    },
    {
      type: "system",
      subtype: "informational",
      timestamp: "2026-01-01T09:00:08.000Z",
      content: "<local-command-stdout>No command named /foo in this session</local-command-stdout>",
    },
    { type: "system", subtype: "informational", timestamp: "2026-01-01T09:00:09.000Z", content: "sidecar: reloaded (10 hooks)" },
  ]);

  assert.deepEqual(
    conversationOf({ key }).turns.map((turn) => ({ role: turn.role, kind: turn.kind, text: turn.text })),
    [
      { role: "system", kind: "command", text: "/compact" },
      { role: "system", kind: "printed", text: "Compacted (ctrl+o to see full summary)" },
      { role: "system", kind: "command", text: "/mode:ic new glass" },
      { role: "system", kind: "printed", text: "sidecar: up at http://sidecar.localhost:4747" },
      { role: "user", kind: undefined, text: "Another Claude session sent a message:\nship it" },
      { role: "user", kind: undefined, text: "[Image: source: /tmp/cmd/1.png]" },
      { role: "system", kind: "command", text: "/foo" },
      { role: "system", kind: "printed", text: "No command named /foo in this session" },
    ],
  );
});

test("a message that joins a running turn is a user turn of its own, and its queued copy never hides the delivered row", () => {
  const key = "11111111";
  const at = (second: number): string => `2026-01-01T10:00:0${second}.000Z`;
  const attached = (
    second: number,
    prompt: unknown,
    origin: string,
    commandMode = "prompt",
  ): Record<string, unknown> => ({
    type: "attachment",
    timestamp: at(second),
    attachment: { type: "queued_command", commandMode, origin: { kind: origin }, prompt },
  });
  writeTranscript(key, "-tmp-joined", [
    { type: "queue-operation", operation: "enqueue", timestamp: at(1), content: "also check the docs" },
    { type: "queue-operation", operation: "remove", timestamp: at(2), content: "also check the docs" },
    attached(1, "also check the docs", "human"),
    attached(
      3,
      [
        { type: "text", text: "ship it" },
        { type: "image", source: {} },
      ],
      "peer",
    ),
    attached(4, "<task-notification>done</task-notification>", "task-notification", "task-notification"),
    { type: "queue-operation", operation: "enqueue", timestamp: at(5), content: "one more thing" },
    { type: "queue-operation", operation: "dequeue", timestamp: at(6) },
    { type: "user", timestamp: at(7), origin: { kind: "human" }, message: { role: "user", content: "one more thing" } },
  ]);

  assert.deepEqual(
    conversationOf({ key }).turns.map(({ role, kind, text, queued, joined, via }) => ({
      role,
      kind,
      text,
      ...(queued && { queued }),
      ...(joined && { joined }),
      ...(via && { via }),
    })),
    [
      { role: "user", kind: undefined, text: "also check the docs", queued: true },
      { role: "system", kind: "drop", text: "also check the docs" },
      { role: "user", kind: undefined, text: "also check the docs", joined: true, via: "terminal" },
      { role: "user", kind: undefined, text: "ship it", joined: true },
      { role: "user", kind: undefined, text: "one more thing", queued: true },
      { role: "system", kind: "drop", text: "" },
      { role: "user", kind: undefined, text: "one more thing", via: "terminal" },
    ],
  );
});
