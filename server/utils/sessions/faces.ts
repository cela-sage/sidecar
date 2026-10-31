import { randomInt } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import z from "zod";
import { readTextSafe } from "../../../lib/files.ts";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import type { AgentFace } from "../../../shared/types/session.ts";

export interface DrawInput {
  key: string;
  project: string;
}

const ICONS = 64;

const Line = z.object({
  key: z.string(),
  project: z.string(),
  name: z.string().min(1),
  icon: z
    .number()
    .int()
    .min(0)
    .max(ICONS - 1),
});

type Drawn = z.infer<typeof Line>;

const file = (): string => join(Sidecar.home(), "agents.jsonl");

const lineOf = (raw: string): Drawn[] => {
  if (!raw.trim()) return [];
  try {
    const parsed = Line.safeParse(JSON.parse(raw));
    return parsed.success ? [parsed.data] : [];
  } catch {
    return [];
  }
};

// Appended, never rewritten, and the first line for a key wins, so a draw holds even when two writers race.
const drawn = (): Map<string, Drawn> => {
  const found = new Map<string, Drawn>();
  for (const one of (readTextSafe(file()) ?? "").split("\n").flatMap(lineOf)) {
    if (!found.has(one.key)) found.set(one.key, one);
  }
  return found;
};

const nameFor = (taken: Set<string>): string => {
  const NAMES = [
    "Abe Ada Ajay Alba Alix Alma Amos Ana Anya Ari Arlo Asa Ash Ava Bea Ben Blair Bo Bram Bruno Cai Cal Cass",
    "Cleo Cora Dag Dani Dara Dax Del Dev Dina Dov Eda Edie Eli Elio Ella Elsa Emil Ena Enzo Esme Eva Evan Ezio",
    "Ezra Fay Fen Fern Finn Flo Gael Gia Gil Gus Gwen Hal Hana Hani Hugo Ida Idris Ilse Ilya Ines Ira Iris Isla",
    "Ivo Ivy Jada Jago Jan Jem Jia Jo Joss Jude Jules Juno Kai Kaz Kira Kit Kofi Lani Lars Lea Leif Lena Leo Lia",
    "Lila Lino Lior Liv Lou Luca Lux Mads Mae Mara Max Mila Milo Mina Mira Nadia Nate Nell Neve Nia Nico Nils",
    "Nina Noa Noor Odile Ola Oli Omar Ona Oona Orla Oscar Otto Pavel Pax Pia Pip Quin Raf Ray Remy Ren Rhea Rina",
    "Rio Rosa Rue Ruth Sam Sana Saul Sela Sid Sol Suki Taj Tal Tam Tara Teo Tess Thea Tia Tilda Toby Tomas Tove",
    "Uma Una Uri Vali Vera Vic Vida Wim Wren Xan Yan Yara Yuki Yves Zara Zeno Zev Zia Zoe",
  ]
    .join(" ")
    .split(" ");
  const free = NAMES.filter((one) => !taken.has(one.toLowerCase()));
  const base = free[randomInt(free.length || 1)];
  if (base) return base;
  const fallback = NAMES[randomInt(NAMES.length)] ?? "Agent";
  let n = 2;
  while (taken.has(`${fallback} ${n}`.toLowerCase())) n += 1;
  return `${fallback} ${n}`;
};

const draw = ({ key, project }: DrawInput): AgentFace => {
  const all = drawn();
  const had = all.get(key);
  if (had) return { name: had.name, icon: had.icon };
  const bucket = project.toLowerCase();
  const taken = new Set([...all.values()].filter((one) => one.project === bucket).map((one) => one.name.toLowerCase()));
  const face = { name: nameFor(taken), icon: randomInt(ICONS) };
  mkdirSync(Sidecar.home(), { recursive: true });
  appendFileSync(file(), `${JSON.stringify({ key, project: bucket, ...face, at: new Date().toISOString() })}\n`);
  return face;
};

const all = (): Map<string, AgentFace> => new Map([...drawn()].map(([key, { name, icon }]) => [key, { name, icon }]));

export const Faces = { all, draw };
