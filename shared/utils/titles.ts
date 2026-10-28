import { Role } from "../types/task.ts";

export interface RoleTitle {
  token: string;
  rest: string;
  role?: Role;
  words: string[];
}

export interface ProjectTitle {
  was: string;
  token: string;
}

export interface LeadTitle extends ProjectTitle {
  slug: string;
}

interface Parts {
  head: string[];
  subject: string[];
}

const MONTH = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/;
const DAY = /^([1-9]|[12][0-9]|3[01])$/;
const TICKET = /^[A-Z][A-Z0-9]*-\d+$/;
const WORDY = /[\p{L}\p{N}]/u;

const isRole = (word = ""): word is Role => (Role as readonly string[]).includes(word);

const parse = (name: string): RoleTitle | undefined => {
  const hit = /^\[([^\]]+)\]\s+(.+)$/.exec(name.trim());
  if (!hit?.[1] || !hit[2]) return undefined;
  const words = hit[2].split(/\s+/);
  return { token: hit[1], rest: hit[2], role: words.find(isRole), words };
};

// The ticket before the role token, or the slug after it, names the task, the way the title rule writes it.
const belongsTo = (title: RoleTitle, slug: string): boolean => {
  if (!title.role) return false;
  const at = title.words.indexOf(title.role);
  return title.words.slice(0, at + 2).some((word) => word.toLowerCase() === slug.toLowerCase());
};

const partsOf = ({ was, token }: ProjectTitle): Parts => {
  const title = parse(was);
  const words = (title?.words ?? was.split(/\s+/)).filter((word) => WORDY.test(word));
  const date = MONTH.test(words[0] ?? "") && DAY.test(words[1] ?? "") ? words.splice(0, 2) : [];
  const tickets: string[] = [];
  while (TICKET.test(words[0] ?? "")) tickets.push(...words.splice(0, 1));
  if (isRole(words[0])) words.splice(0, words[1]?.includes("-") ? 2 : 1);
  return { head: [...date, ...(title?.token === token ? tickets : [])], subject: words };
};

const inProject = (to: ProjectTitle): string => {
  const { head, subject } = partsOf(to);
  return `[${to.token}] ${[...head, ...subject].join(" ")}`;
};

const asLead = ({ slug, ...to }: LeadTitle): string => {
  const { head, subject } = partsOf(to);
  return `[${to.token}] ${[...head, "TL", slug, ...subject].join(" ")}`;
};

export const Titles = { asLead, belongsTo, inProject, parse };
