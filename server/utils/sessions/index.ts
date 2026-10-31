import { readdirSync } from "node:fs";
import type { AgentFace, LiveSession } from "../../../shared/types/session.ts";
import { sessionOrder } from "../../../shared/utils/sessions.ts";
import { Titles } from "../../../shared/utils/titles.ts";
import { Agents } from "./agents.ts";
import { artifactsOf, keysWithArtifacts } from "./artifact-lists.ts";
import { sessionColor } from "./identity.ts";
import { Faces } from "./faces.ts";
import { agentView, jobs, type JobEntry } from "./jobs.ts";
import { Lives } from "./life.ts";
import { conversationsHome, isKey, keyOf } from "./paths.ts";
import { liveEntries, type RegistryEntry } from "./registry.ts";
import { cwdFromSlug } from "./slug.ts";
import { identityOf, transcriptIndex, type TranscriptIdentity, type TranscriptRef } from "./transcripts.ts";

// The rejected build rendered a bare hex id as a title; a name that IS the id is not a name.
function realName(candidate: string | undefined, key: string, id: string): string | undefined {
  if (!candidate) return undefined;
  const trimmed = candidate.trim();
  if (!trimmed || trimmed === key || trimmed === id || /^[0-9a-f]{8}$/.test(trimmed)) return undefined;
  return trimmed;
}

const seenKeys = (): string[] => {
  try {
    return readdirSync(conversationsHome()).filter(isKey);
  } catch {
    return [];
  }
};

interface Sources {
  entry?: RegistryEntry;
  job?: JobEntry;
  ref?: TranscriptRef;
  view?: Set<string>;
  agent?: AgentFace;
}

function build(key: string, { entry, job, ref, view, agent }: Sources): LiveSession | undefined {
  const id = job?.id || entry?.id || ref?.id;
  // Neither a job, a live process nor a transcript means nothing on disk can say what this session was.
  if (!id) return undefined;
  const identity: TranscriptIdentity = ref ? identityOf(ref) : { names: [] };
  const cwd = job?.cwd || entry?.cwd || identity.cwd || (ref ? cwdFromSlug(ref.slug) : undefined);
  if (!cwd) return undefined;
  return {
    id,
    key,
    name: [job?.name, entry?.name, ...identity.names].map((one) => realName(one, key, id)).find(Boolean),
    cwd,
    life: Lives.of({ entry, job }),
    color: sessionColor(key),
    artifacts: artifactsOf(key),
    agents: ref ? Agents.of(ref) : undefined,
    status: job?.status || entry?.status,
    gitBranch: identity.gitBranch,
    lastActive: Math.round(Math.max(entry?.updatedAt || 0, ref?.mtimeMs || 0, job?.startedAt || 0)) || undefined,
    lane: job?.lane,
    detail: job?.detail,
    archived: job ? undefined : true,
    startedAt: job?.startedAt,
    ...(view ? { inView: view.has(key) } : {}),
    ...(agent ? { agent } : {}),
  };
}

const withFace = (session: LiveSession): LiveSession => {
  const title = session.life === "alive" && session.name ? Titles.parse(session.name) : undefined;
  if (session.agent || !title || title.role === "EA") return session;
  return { ...session, agent: Faces.draw({ key: session.key, project: title.token }) };
};

export interface SessionsQuery {
  scope?: "all" | "live";
  key?: string;
}

// `live` is what a poll can see change: processes and jobs, plus the conversation on screen.
export function liveSessions({ scope = "all", key }: SessionsQuery = {}): LiveSession[] {
  const entries = new Map(liveEntries().map((entry) => [keyOf(entry.id), entry]));
  const running = new Map(jobs().map((job) => [job.key, job]));
  const view = agentView();
  const transcripts = transcriptIndex();
  const faces = Faces.all();
  const keys = new Set<string>([...running.keys(), ...entries.keys()]);
  if (key) keys.add(key);
  if (scope === "all") for (const one of [...keysWithArtifacts(), ...seenKeys()]) keys.add(one);
  const out: LiveSession[] = [];
  for (const one of keys) {
    const sources = { entry: entries.get(one), job: running.get(one), ref: transcripts.get(one), view };
    const session = build(one, { ...sources, agent: faces.get(one) });
    if (session) out.push(withFace(session));
  }
  return out.sort(sessionOrder);
}
