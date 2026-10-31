import type { DockTab } from "./dock.ts";
import type { Question } from "./question.ts";
import type { Life } from "./session.ts";
import type { AskKind, TaskState, Who } from "./task.ts";

export interface Topics {
  "artifact.created": { slug: string; title: string; path: string };
  "task.changed": { slug: string; state: TaskState };
  "task.escalated": { slug: string; title: string; thread: string; kind: AskKind; question: string };
  "task.decided": { slug: string; thread: string; text: string; who: Who };
  "terminal.changed": TerminalState;
  "dock.changed": { tabs: DockTab[] };
  "runs.changed": { project: string };
  "conversation.changed": { key: string; doing: boolean; asking: boolean; life: Life };
  "conversation.unseen": ConversationUnseen;
  "question.changed": QuestionChanged;
  "message.landed": { key: string; text: string };
  "commands.changed": { key: string };
  "usage.changed": { key: string };
  "relay.sent": RelaySent;
  "channel.changed": { slug: string; raised: number };
  "channel.raised": ChannelRaised;
}

export interface ChannelRaised {
  slug: string;
  title: string;
  post: string;
  from: string;
  text: string;
}

export interface RelaySent {
  from: string;
  to: string;
  text: string;
  slug?: string;
}

/** Unseen since the turn that ended at `endedAt`, seen once a frame comes without it. */
export interface ConversationUnseen {
  key: string;
  endedAt?: number;
}

/** Open while `questions` is there, settled once a frame comes without it. */
export interface QuestionChanged {
  key: string;
  ref: string;
  questions?: Question[];
}

export interface TerminalHeld {
  key: string;
  name?: string;
}

export interface TerminalState {
  following: boolean;
  held?: TerminalHeld;
}

export type Topic = keyof Topics;

// Kafka's convention: the offset is where the next event starts, so a consumer resumes from the last one it handled.
export type SidecarEvent<T extends Topic = Topic> = {
  [K in T]: { topic: K; key?: string; at: string; offset: number; data: Topics[K] };
}[T];
