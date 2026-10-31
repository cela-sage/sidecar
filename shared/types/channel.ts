import type { Life, SessionStatus } from "./session.ts";
import type { Role } from "./task.ts";

export interface ChannelMember {
  key: string;
  role: Role;
  title: string;
  life: Life;
  status?: SessionStatus;
  joined: string;
}

export interface OutsideRead {
  key: string;
  read?: string;
}

export interface PostReach {
  all?: true;
  boss?: true;
  notified: string[];
  missed: string[];
  outside: OutsideRead[];
}

export interface ChannelPost {
  kind: "post";
  id: string;
  at: string;
  by: string;
  text: string;
  thread?: string;
  reach: PostReach;
  answered?: string;
}

interface Said {
  id: string;
  at: string;
  by?: string;
}

export type SystemLine =
  | (Said & { kind: "join"; key: string })
  | (Said & { kind: "kill"; keys: string[] })
  | (Said & { kind: "resume"; keys: string[] })
  | (Said & { kind: "archive" })
  | (Said & { kind: "restore" });

export type ChannelLine = ChannelPost | SystemLine;

export interface DirectMessage {
  at: string;
  from: string;
  to: string;
  text: string;
}

export interface ChannelDm {
  pair: [string, string];
  messages: DirectMessage[];
}

export interface Channel {
  slug: string;
  title: string;
  archived: boolean;
  raised: string[];
  members: ChannelMember[];
  lines: ChannelLine[];
  threads: Record<string, ChannelPost[]>;
  dms: ChannelDm[];
}

export interface Refused {
  key: string;
  reason: string;
}

export interface Killed {
  killed: string[];
  refused: Refused[];
}

export interface Resumed {
  resumed: string[];
  refused: Refused[];
}
