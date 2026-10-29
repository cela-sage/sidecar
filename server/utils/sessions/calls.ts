import type { DiffHunk, ToolCall, ToolDiff } from "../../../shared/types/conversation.ts";
import { splitLines } from "../../../lib/text.ts";

export interface ToolResult {
  ref: string;
  out?: string;
  diff?: ToolDiff;
  failed?: true;
}

type Rec = Record<string, unknown>;

const OUT_HEAD = 800;
const OUT_TAIL = 2200;
const DIFF_LINES = 240;
const EDITS = new Set(["Edit", "MultiEdit", "NotebookEdit", "Write"]);

const isRec = (value: unknown): value is Rec => typeof value === "object" && !!value;
const textAt = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);
const countAt = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

// Read's offset is the first line it returns, counted from 1, and its limit how many follow.
const readOf = (input: Rec): ToolCall | undefined => {
  const path = textAt(input.file_path);
  if (!path) return undefined;
  const offset = countAt(input.offset);
  const limit = countAt(input.limit);
  const from = offset ?? (limit ? 1 : undefined);
  return { kind: "read", path, ...(from ? { from } : {}), ...(from && limit ? { to: from + limit - 1 } : {}) };
};

const callOf = (tool: string, input: unknown): ToolCall | undefined => {
  if (!isRec(input)) return undefined;
  if (tool === "Read") return readOf(input);
  if (tool === "Bash") {
    const command = textAt(input.command);
    return command ? { kind: "run", command } : undefined;
  }
  if (!EDITS.has(tool)) return undefined;
  const path = textAt(input.file_path) ?? textAt(input.notebook_path);
  return path ? { kind: "edit", path } : undefined;
};

// Head and tail, since a run's verdict sits at its end and a search's best hits at its start.
const clip = (text: string): string =>
  text.length <= OUT_HEAD + OUT_TAIL ? text : `${text.slice(0, OUT_HEAD)}\n…\n${text.slice(-OUT_TAIL)}`;

const textOf = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => (isRec(part) && typeof part.text === "string" ? [part.text] : [])).join("\n");
};

const hunksOf = (raw: unknown): DiffHunk[] =>
  Array.isArray(raw)
    ? raw.flatMap((one) =>
        isRec(one) && Array.isArray(one.lines)
          ? [
              {
                oldStart: countAt(one.oldStart) ?? 0,
                newStart: countAt(one.newStart) ?? 0,
                lines: one.lines.filter((line): line is string => typeof line === "string"),
              },
            ]
          : [],
      )
    : [];

// A new file's structuredPatch is empty, so its whole body is the change.
const createdOf = (meta: Rec): DiffHunk[] => {
  if (meta.type !== "create" || typeof meta.content !== "string") return [];
  const lines = splitLines(meta.content.replace(/\r?\n$/, ""));
  return [{ oldStart: 0, newStart: 1, lines: lines.map((line) => `+${line}`) }];
};

const diffOf = (meta: Rec): ToolDiff | undefined => {
  const patched = hunksOf(meta.structuredPatch);
  const hunks = patched.length ? patched : createdOf(meta);
  if (!hunks.length) return undefined;
  let add = 0;
  let del = 0;
  for (const line of hunks.flatMap((one) => one.lines)) {
    if (line.startsWith("+")) add++;
    else if (line.startsWith("-")) del++;
  }
  const kept: DiffHunk[] = [];
  let room = DIFF_LINES;
  for (const hunk of hunks) {
    if (room <= 0) break;
    kept.push({ ...hunk, lines: hunk.lines.slice(0, room) });
    room -= hunk.lines.length;
  }
  return { add, del, hunks: kept, ...(room < 0 || kept.length < hunks.length ? { isClipped: true as const } : {}) };
};

// Told apart by shape, since a result can land a slice after its call, and a read's file or an edit's receipt is dropped.
const resultOf = (meta: unknown, content: unknown): ToolResult | undefined => {
  const first = Array.isArray(content) ? content[0] : undefined;
  if (!isRec(first) || first.type !== "tool_result" || typeof first.tool_use_id !== "string") return undefined;
  const failed = first.is_error === true ? (true as const) : undefined;
  const shaped = isRec(meta) ? meta : undefined;
  const diff = shaped ? diffOf(shaped) : undefined;
  const isQuiet = !failed && (!!diff || isRec(shaped?.file));
  const out = isQuiet ? "" : clip(textOf(first.content)).trim();
  return { ref: first.tool_use_id, ...(out ? { out } : {}), ...(diff ? { diff } : {}), ...(failed ? { failed } : {}) };
};

export const ToolCalls = { callOf, resultOf };
