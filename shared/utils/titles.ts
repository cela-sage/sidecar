import { Role } from "../types/task.ts";

export interface RoleTitle {
  token: string;
  rest: string;
  role?: Role;
  words: string[];
}

const parse = (name: string): RoleTitle | undefined => {
  const hit = /^\[([^\]]+)\]\s+(.+)$/.exec(name.trim());
  if (!hit?.[1] || !hit[2]) return undefined;
  const words = hit[2].split(/\s+/);
  return { token: hit[1], rest: hit[2], role: Role.find((role) => words.includes(role)), words };
};

// The ticket before the role token, or the slug after it, names the task, the way the title rule writes it.
const belongsTo = (title: RoleTitle, slug: string): boolean => {
  if (!title.role) return false;
  const at = title.words.indexOf(title.role);
  return title.words.slice(0, at + 2).some((word) => word.toLowerCase() === slug.toLowerCase());
};

export const Titles = { belongsTo, parse };
