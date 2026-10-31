export const SessionAgentState = ["working", "idle", "killed"] as const;
export type SessionAgentState = (typeof SessionAgentState)[number];

export interface SessionAgentChange {
  id: string;
  state: SessionAgentState;
}

export interface SessionAgent extends SessionAgentChange {
  name: string;
  color: string;
  description?: string;
}

export interface AgentFace {
  name: string;
  icon: number;
}

export type SessionStatus = "busy" | "idle" | "waiting";

export const Life = ["alive", "killed"] as const;
export type Life = (typeof Life)[number];

export interface LifeChange {
  key: string;
  life: Life;
}

// What the sidecar shows of a conversation: the registry's status, or gone once no process holds it.
export type SessionState = SessionStatus | "gone";

export interface SessionLane {
  name: "review" | "blocked" | "working" | "done";
  // Set when `claude agents` could not be run and the lane came off the job file, which disagrees.
  derived?: boolean;
}

export interface LiveSession {
  id: string;
  key: string;
  name?: string;
  cwd: string;
  life: Life;
  color?: string;
  artifacts: string[];
  agents?: SessionAgent[];
  // Additive to the frozen contract: a narrower type on the client ignores these at runtime.
  status?: SessionStatus;
  gitBranch?: string;
  lastActive?: number;
  lane?: SessionLane;
  detail?: string;
  // No background job owns this key: history the sidecar kept, not a conversation `claude agents` lists.
  archived?: boolean;
  startedAt?: number;
  // Set only when `claude agents` answered, so its absence means the agent view is unknown, not empty.
  inView?: boolean;
  agent?: AgentFace;
}

export interface Retitled {
  key: string;
  title: string;
}
