import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import z from "zod";
import * as Events from "../../../lib/sidecar/events.ts";
import { SessionAgentState, type SessionAgent, type SessionAgentChange } from "../../../shared/types/session.ts";
import { readTextSafe } from "../../../lib/files.ts";
import { projectsHome, teamsHome } from "./paths.ts";
import { readRecords, type TranscriptRef } from "./transcripts.ts";

const Change = z.object({
  id: z.string().min(1),
  state: z.enum(SessionAgentState),
}) satisfies z.ZodType<SessionAgentChange>;

const heard = new Map<string, Map<string, SessionAgentState>>();

// The longest a tool call runs before the harness ends it, so an open turn silent past it is a loop that died.
const STALE_MS = z.coerce.number().positive().catch(600_000).parse(process.env.SIDECAR_SPECIALIST_STALE_MS);
const TAIL_BYTES = 64 * 1024;

function text(value: unknown): string | undefined {
  return typeof value === "string" && !!value.trim() ? value.trim() : undefined;
}

function json(path: string): Record<string, unknown> | undefined {
  const raw = readTextSafe(path);
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && !!value ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function mtime(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

// A turn stays open until the model's last message ends without asking for a tool.
function ranOf(transcript: string): SessionAgentState {
  const last = readRecords(transcript, "tail", TAIL_BYTES).findLast(
    (entry) => entry.type === "user" || entry.type === "assistant",
  );
  const stop = (last?.message as Record<string, unknown> | undefined)?.stop_reason;
  if (last?.type === "assistant" && typeof stop === "string" && stop !== "tool_use") return "idle";
  return Date.now() - mtime(transcript) < STALE_MS ? "working" : "idle";
}

type Who = Omit<SessionAgent, "id" | "state">;

function whoOf(record: Record<string, unknown> = {}): Who | undefined {
  const name = text(record.name);
  const color = text(record.color);
  // The lead carries no colour because it is the session itself, not one of its agents.
  if (!name || !color) return undefined;
  const description = text(record.description);
  return { name, color, ...(description ? { description } : {}) };
}

// Its meta and its transcript are both named after the agent id the mod hears it by.
function fromSubagents(ref: TranscriptRef): SessionAgent[] {
  const dir = join(projectsHome(), ref.slug, ref.id, "subagents");
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  const own = heard.get(ref.key);
  return files
    .filter((file) => file.startsWith("agent-") && file.endsWith(".meta.json"))
    .map((file) => ({ id: file.slice("agent-".length, -".meta.json".length), path: join(dir, file) }))
    .map((meta) => ({ ...meta, at: mtime(meta.path) }))
    .sort((a, b) => a.at - b.at)
    .flatMap(({ id, path }) => {
      const who = whoOf(json(path));
      return who ? [{ id, ...who, state: own?.get(id) ?? ranOf(join(dir, `agent-${id}.jsonl`)) }] : [];
    });
}

// Only a session with a team still on disk has this, so it stands in when subagents/ was pruned.
function fromTeam(key: string): SessionAgent[] {
  const config = json(join(teamsHome(), `session-${key}`, "config.json"));
  const members = config?.members;
  if (!Array.isArray(members)) return [];
  return members.flatMap((member: unknown) => {
    const record = typeof member === "object" && member ? (member as Record<string, unknown>) : {};
    const [id, who] = [text(record.agentId) ?? "", whoOf(record)];
    return who ? [{ id, ...who, state: heard.get(key)?.get(id) ?? "idle" }] : [];
  });
}

// A respawn under a name keeps that name's place and takes the newest one's state.
const of = (ref: TranscriptRef): SessionAgent[] => {
  const found = fromSubagents(ref);
  const agents = found.length ? found : fromTeam(ref.key);
  const byName = new Map<string, SessionAgent>();
  for (const agent of agents) byName.set(agent.name, agent);
  return [...byName.values()];
};

const hear = (key: string, { id, state }: SessionAgentChange): void => {
  const own = heard.get(key) ?? new Map<string, SessionAgentState>();
  if (own.get(id) === state) return;
  heard.set(key, own.set(id, state));
  Events.publish({ topic: "agent.changed", key, data: { key, id, state } });
};

export const Agents = { Change, hear, of };
