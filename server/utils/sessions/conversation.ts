import { splitLines } from "../../../lib/text.ts";
import type { ToolCall, ToolDiff } from "../../../shared/types/conversation.ts";
import type { Question, QuestionOption } from "../../../shared/types/question.ts";
import { ToolCalls } from "./calls.ts";
import { plain } from "./relay.ts";
import { argOf, readOut } from "./speaker.ts";
import { readRange, transcriptIndex, type TranscriptGrowth } from "./transcripts.ts";

// Narration and answer share the provider's `text` block, told apart only by position.
export type TurnKind =
  "thinking" | "narration" | "answer" | "acting" | "note" | "summary" | "command" | "printed" | "drop" | "done" | "end";

export type ConversationTurn = {
  role: "user" | "assistant" | "system";
  text: string;
  at: number;
  kind?: TurnKind;
  tool?: string;
  arg?: string;
  call?: ToolCall;
  /** AskUserQuestion only, so the chat can offer the options instead of an opaque tool row. */
  ask?: Question[];
  /** The provider's tool_use id, so a result pairs back to its call. */
  ref?: string;
  /** Started with run_in_background, so it is long-running by construction. */
  bg?: true;
  /** Typed but not yet delivered, so the turn it belongs to has not started. */
  queued?: boolean;
  /** Delivered into a turn already running, so the one in flight is not over. */
  joined?: true;
  out?: string;
  diff?: ToolDiff;
  failed?: true;
  /** Typed at the session's own prompt; a message from the sidecar arrives through the inbox and carries none. */
  via?: "terminal";
  model?: string;
  mode?: string;
};

export type ConversationSlice = {
  turns: ConversationTurn[];
  offset: number;
};

export type ConversationGrowth = TranscriptGrowth & ConversationSlice;

export type ConversationQuery = {
  key: string;
  /** The transcript a caller already found, which spares a read of every transcript on disk. */
  path?: string;
  since?: number;
  until?: number;
};

const QUEUE_ECHO_MS = 60_000;

export function conversationOf({
  key,
  path = transcriptIndex().get(key)?.path,
  since = 0,
  until = Number.POSITIVE_INFINITY,
}: ConversationQuery): ConversationSlice {
  const start = Math.max(0, since);
  const read = path ? readRange(path, start, until) : undefined;
  if (!read) return { turns: [], offset: path ? start : 0 };
  const turns: ConversationTurn[] = [];
  // The harness writes a delivered message twice with replies in between; a queued copy only announces it, so it never hides the row.
  const echo = new Map<string, number>();
  // A result carries no tool name of its own; only the call it pairs to does.
  const toolByRef = new Map<string, string>();
  for (const line of splitLines(read.text)) {
    for (const turn of turnOf(line)) {
      if (turn.role === "user" && !turn.queued) {
        const said = echo.get(turn.text);
        if (said && turn.at - said < QUEUE_ECHO_MS) continue;
        echo.set(turn.text, turn.at);
      }
      if (turn.kind === "acting" && turn.ref && turn.tool) toolByRef.set(turn.ref, turn.tool);
      else if (turn.kind === "done" && turn.ref) turn.tool = toolByRef.get(turn.ref);
      turns.push(turn);
    }
  }
  settle(turns);
  return { turns, offset: read.end };
}

// A mid-turn message lands only here: the copy that reached the model is buried in a
// tool_result the text scan skips.
function queuedOf(entry: Record<string, unknown>): ConversationTurn[] {
  const at = atOf(entry.timestamp);
  if (!at) return [];
  const { content } = entry;
  const said = typeof content === "string" ? content : "";
  if (entry.operation === "enqueue") return said.trim() ? spoke({ text: said, at, queued: true }) : [];
  // Cancelled, or handed to the model as a real turn: either way the queued copy stops standing.
  if (entry.operation === "remove") return [{ role: "system", kind: "drop", text: plain(said), at }];
  if (entry.operation === "dequeue" || entry.operation === "popAll") {
    return [{ role: "system", kind: "drop", text: "", at }];
  }
  return [];
}

type Spoken = { text: string; at: number; queued?: boolean; joined?: boolean; via?: "terminal" };

// One entry can hold a withdrawn ask, an interruption and a live ask, and all three keep their order.
function spoke({ text, at, queued = false, joined = false, via }: Spoken): ConversationTurn[] {
  return readOut(text).map((piece): ConversationTurn => {
    if (piece.kind === "note") return { role: "system", text: piece.label, at, kind: "note" };
    if (piece.kind === "command") return { role: "system", text: piece.line, at, kind: "command" };
    if (piece.kind === "printed") return { role: "system", text: piece.text, at, kind: "printed" };
    return {
      role: "user",
      text: plain(piece.text),
      at,
      queued: queued || undefined,
      ...(joined ? { joined: true as const } : {}),
      ...(via ? { via } : {}),
    };
  });
}

// A message that reaches a running turn is recorded as this attachment alone, stamped with when it arrived and with no user row.
function joinedOf({ attachment, timestamp }: Record<string, unknown>): ConversationTurn[] {
  const at = atOf(timestamp);
  if (!at || typeof attachment !== "object" || !attachment) return [];
  const sent = attachment as Record<string, unknown>;
  const said = sent.type === "queued_command" && sent.commandMode === "prompt" ? saidOf(sent.prompt) : undefined;
  return said ? spoke({ text: said.text, at, joined: true, via: viaOf(sent) }) : [];
}

const ranIn = (content: unknown, at: number): ConversationTurn[] =>
  typeof content === "string"
    ? spoke({ text: content, at }).filter((turn) => turn.kind === "command" || turn.kind === "printed")
    : [];

// A skill's expansion rides with its turn, or with the tool call that loaded it, and is for the model alone.
const isContext = (entry: Record<string, unknown>): boolean =>
  entry.isMeta === true && (entry.turnCompanion === true || !!entry.sourceToolUseID);

const viaOf = ({ origin }: Record<string, unknown>): "terminal" | undefined =>
  typeof origin === "object" && !!origin && "kind" in origin && origin.kind === "human" ? "terminal" : undefined;

// A turn the harness wrote itself, such as an API error, names no real model.
const modelOf = (message: Record<string, unknown>): string | undefined =>
  typeof message.model === "string" && message.model.startsWith("claude-") ? message.model : undefined;

const modeOf = ({ permissionMode }: Record<string, unknown>): string | undefined =>
  typeof permissionMode === "string" && permissionMode ? permissionMode : undefined;

const inMode = (mode?: string) => (turn: ConversationTurn): ConversationTurn => (mode ? { ...turn, mode } : turn);

function turnOf(line: string): ConversationTurn[] {
  const entry = record(line);
  if (!entry) return [];
  if (entry.type === "queue-operation") return queuedOf(entry);
  if (entry.type === "attachment") return joinedOf(entry);
  if (entry.isSidechain) return [];
  const at = atOf(entry.timestamp);
  if (!at) return [];
  if (entry.type === "system") {
    if (entry.subtype === "turn_duration") return [{ role: "system", text: "", at, kind: "end" }];
    return ranIn(entry.content, at);
  }
  if (entry.type !== "user" && entry.type !== "assistant") return [];
  // The 28KB summary body is never worth carrying into a turn; `at` names the row for `summaryOf` to read on demand.
  if (entry.isCompactSummary) return [{ role: "system", text: "Compacted", at, kind: "summary" }];
  const message = entry.message;
  if (typeof message !== "object" || !message) return [];
  const content = (message as Record<string, unknown>).content;
  // A result-only entry has no text, thinking or tool_use block, so saidOf below would drop it.
  if (entry.type === "user") {
    const result = ToolCalls.resultOf(entry.toolUseResult, content);
    if (result) return [inMode(modeOf(entry))({ role: "system", text: "", at, kind: "done", ...result })];
  }
  const said = saidOf(content);
  if (!said) return [];
  if (entry.type === "user") {
    return isContext(entry) ? [] : spoke({ text: said.text, at, via: viaOf(entry) }).map(inMode(modeOf(entry)));
  }
  const model = modelOf(message as Record<string, unknown>);
  return [
    {
      role: "assistant",
      text: said.text,
      at,
      kind: said.kind,
      tool: said.tool,
      arg: said.arg,
      call: said.call,
      ref: said.ref,
      bg: said.bg,
      ask: said.ask,
      ...(model ? { model } : {}),
    },
  ];
}

type Said = {
  text: string;
  kind: TurnKind;
  tool?: string;
  arg?: string;
  call?: ToolCall;
  ref?: string;
  bg?: true;
  ask?: Question[];
};

function optionsOf(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((one) => {
    const rec = one as Record<string, unknown>;
    if (typeof rec?.label !== "string" || !rec.label) return [];
    return [{ label: rec.label, description: typeof rec.description === "string" ? rec.description : undefined }];
  });
}

function asksOf(input: unknown): Question[] | undefined {
  if (typeof input !== "object" || !input) return undefined;
  const { questions } = input as { questions?: unknown };
  if (!Array.isArray(questions)) return undefined;
  const out = questions.flatMap((one) => {
    const rec = one as Record<string, unknown>;
    if (typeof rec?.question !== "string" || !rec.question) return [];
    return [
      {
        question: rec.question,
        header: typeof rec.header === "string" ? rec.header : undefined,
        multi: rec.multiSelect === true ? (true as const) : undefined,
        options: optionsOf(rec.options),
      },
    ];
  });
  return out.length ? out : undefined;
}

// An assistant turn carries one block type at a time, so the first kind present decides the turn.
function saidOf(content: unknown): Said | undefined {
  if (typeof content === "string") return content.trim() ? { text: content, kind: "narration" } : undefined;
  if (!Array.isArray(content)) return undefined;
  const spoken: string[] = [];
  const thought: string[] = [];
  let tool: string | undefined;
  let arg: string | undefined;
  let call: ToolCall | undefined;
  let ref: string | undefined;
  let bg: true | undefined;
  let ask: Question[] | undefined;
  for (const part of content) {
    if (typeof part !== "object" || !part) continue;
    const rec = part as Record<string, unknown>;
    if (rec.type === "text" && typeof rec.text === "string") spoken.push(rec.text);
    else if (rec.type === "thinking" && typeof rec.thinking === "string") thought.push(rec.thinking);
    else if (rec.type === "tool_use" && typeof rec.name === "string" && !tool) {
      tool = rec.name;
      arg = argOf(rec.name, rec.input);
      call = ToolCalls.callOf(rec.name, rec.input);
      ask =rec.name === "AskUserQuestion" ? asksOf(rec.input) : undefined;
      ref = typeof rec.id === "string" ? rec.id : undefined;
      const input = rec.input as Record<string, unknown> | undefined;
      bg = input?.run_in_background === true ? true : undefined;
    }
  }
  const say = spoken.join("");
  if (say.trim()) return { text: say, kind: "narration" };
  const think = thought.join("");
  if (think.trim()) return { text: think, kind: "thinking" };
  return tool ? { text: tool, kind: "acting", tool, arg, call, ref, bg, ask } : undefined;
}

// Nothing marks an answer at the time it is written; it is the last thing said before the turn ends or the user speaks.
function settle(turns: ConversationTurn[]): void {
  let latest: ConversationTurn | undefined;
  for (const turn of turns) {
    if ((turn.role === "user" && !turn.queued && !turn.joined) || turn.kind === "end") {
      if (latest) latest.kind = "answer";
      latest = undefined;
    } else if (turn.kind === "narration") {
      latest = turn;
    }
  }
}

function atOf(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

function record(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed[0] !== "{") return undefined;
  try {
    const value: unknown = JSON.parse(trimmed);
    return typeof value === "object" && !!value ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
