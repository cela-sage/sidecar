import { askBlank } from "~~/server/utils/sessions/ask-claude/blank";
import type { AskClaudeExchange, AskClaudeReply, AskClaudeRequest } from "~~/shared/types/ask-claude";

// The newest twenty, the same window /btw replays, so a follow-up can lean on what was asked before.
const HISTORY_MAX = 20;

function isExchange(value: unknown): value is AskClaudeExchange {
  const record = value as Record<string, unknown> | undefined;
  return typeof record?.question === "string" && typeof record.response === "string";
}

function requestOf(raw: unknown): AskClaudeRequest | undefined {
  const record = raw as Record<string, unknown> | undefined;
  const question = typeof record?.question === "string" ? record.question.trim() : "";
  const history = record?.history ?? [];
  if (!question || !Array.isArray(history) || !history.every(isExchange)) return undefined;
  const asked = { question, history: history.slice(-HISTORY_MAX) };
  return typeof record?.path === "string" && record.path ? { ...asked, path: record.path } : asked;
}

export default defineEventHandler(async (event): Promise<AskClaudeReply> => {
  const key = getRouterParam(event, "key") || "";
  const request = requestOf(await readBody(event));
  if (!key || !request) throw createError({ statusCode: 400, statusMessage: "Invalid request body" });
  // A closed tab or a cancel drops the connection, which is the only signal the answer is no longer wanted.
  const abort = new AbortController();
  event.node.res.on("close", () => abort.abort());
  return askBlank({ key, ...request, signal: abort.signal });
});
