import type { ChannelMember } from "../../../shared/types/channel.ts";
import type { LiveSession } from "../../../shared/types/session.ts";
import type { Role } from "../../../shared/types/task.ts";
import { Titles } from "../../../shared/utils/titles.ts";
import type { Folded } from "./fold.ts";

export interface Candidate {
  session: LiveSession;
  role: Role;
}

interface DeriveInput {
  sessions: LiveSession[];
  slug: string;
  token?: string;
}

const ORDER: Role[] = ["DL", "SL", "IC", "EA"];

const sameWord = (a = "", b = ""): boolean => a.toLowerCase() === b.toLowerCase();

const rank = (role: Role): number => ORDER.indexOf(role);

const derive = ({ sessions, slug, token }: DeriveInput): Candidate[] =>
  sessions.flatMap((session) => {
    if (session.archived && session.life !== "alive") return [];
    const title = session.name ? Titles.parse(session.name) : undefined;
    if (!title?.role) return [];
    const isCrew = (title.role === "IC" || title.role === "SL") && Titles.belongsTo(title, slug);
    const isLead = title.role === "DL" && !!token && sameWord(title.token, token);
    return isCrew || isLead ? [{ session, role: title.role }] : [];
  });

// Whoever joined stays a member, killed or retitled, so the live session only refreshes what it says now.
const of = (folded: Folded, sessions: LiveSession[]): ChannelMember[] => {
  const byKey = new Map(sessions.map((one) => [one.key, one]));
  return [...folded.joined.values()]
    .map(({ key, title, role, at }): ChannelMember => {
      const session = byKey.get(key);
      const now = session?.name ? Titles.parse(session.name)?.role : undefined;
      return {
        key,
        role: now ?? role,
        title: session?.name ?? title,
        life: session?.life ?? "killed",
        ...(session?.status ? { status: session.status } : {}),
        ...(session?.agent ? { agent: session.agent } : {}),
        joined: at,
      };
    })
    .sort(
      (a, b) =>
        Number(a.life === "killed") - Number(b.life === "killed") ||
        rank(a.role) - rank(b.role) ||
        a.joined.localeCompare(b.joined),
    );
};

export const Members = { derive, of, rank };
