import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import z from "zod";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import type { RunConfig, RunGroup } from "../../../shared/types/runs.ts";
import type { Project } from "../../../shared/types/task.ts";

const Manifest = z.object({ scripts: z.record(z.string(), z.string()).optional() });
const Written = z.record(
  z.string(),
  z.array(z.object({ name: z.string().min(1), command: z.string().min(1), folder: z.string().optional() })),
);
type Written = z.infer<typeof Written>;

const LOCKS: [string, string][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["yarn.lock", "yarn"],
];
// A rule name at the start of a line, never a .PHONY-style special, a pattern rule or a := assignment.
const TARGET = /^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*:(?!=)/gm;

const store = (): string => join(Sidecar.home(), "runs.json");

const parsedJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const readText = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

const written = (): Written => Written.safeParse(parsedJson(readText(store()) ?? "")).data ?? {};

const runnerOf = (folder: string): string => LOCKS.find(([lock]) => existsSync(join(folder, lock)))?.[1] ?? "npm";

const scriptsOf = (folder: string, repo: string): RunConfig[] => {
  const scripts = Manifest.safeParse(parsedJson(readText(join(folder, "package.json")) ?? "")).data?.scripts ?? {};
  const runner = runnerOf(folder);
  return Object.entries(scripts).map(([name, body]) => ({
    id: `package.json:${repo}:${name}`,
    name,
    command: `${runner} run ${name}`,
    shown: body,
    folder,
    source: "package.json",
    repo,
  }));
};

const targetsOf = (folder: string, repo: string): RunConfig[] => {
  const text = readText(join(folder, "Makefile")) ?? "";
  const names = [...new Set([...text.matchAll(TARGET)].map((hit) => hit[1] ?? ""))].filter(Boolean);
  return names.map((name) => ({
    id: `Makefile:${repo}:${name}`,
    name,
    command: `make ${name}`,
    shown: `make ${name}`,
    folder,
    source: "Makefile",
    repo,
  }));
};

const reposOf = (root: string): string[] => {
  try {
    return readdirSync(root)
      .filter((name) => !name.startsWith(".") && statSync(join(root, name)).isDirectory())
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
};

const folderOf = (project: Project, folder?: string): string =>
  !folder ? project.folder : isAbsolute(folder) ? folder : join(project.folder, folder);

const groupsOf = (project: Project): RunGroup[] => {
  const repos = reposOf(project.folder).flatMap((repo): RunGroup[] => {
    const folder = join(project.folder, repo);
    const scripts = scriptsOf(folder, repo);
    const targets = targetsOf(folder, repo);
    return [
      ...(scripts.length ? [{ source: "package.json" as const, repo, configs: scripts }] : []),
      ...(targets.length ? [{ source: "Makefile" as const, repo, configs: targets }] : []),
    ];
  });
  const theirs = (written()[project.key] ?? []).map(
    (one): RunConfig => ({
      id: `assistant::${one.name}`,
      name: one.name,
      command: one.command,
      shown: one.command,
      folder: folderOf(project, one.folder),
      source: "assistant",
    }),
  );
  return [...repos, ...(theirs.length ? [{ source: "assistant" as const, configs: theirs }] : [])];
};

const find = (project: Project, id: string): RunConfig | undefined =>
  groupsOf(project)
    .flatMap((group) => group.configs)
    .find((one) => one.id === id);

const write = (project: string, entry: { name: string; command: string; folder?: string }): void => {
  const all = written();
  all[project] = [...(all[project] ?? []).filter((one) => one.name !== entry.name), entry];
  mkdirSync(dirname(store()), { recursive: true });
  writeFileSync(store(), `${JSON.stringify(all, null, 2)}\n`);
};

const remove = (project: string, name: string): boolean => {
  const all = written();
  const kept = (all[project] ?? []).filter((one) => one.name !== name);
  if (kept.length === (all[project] ?? []).length) return false;
  all[project] = kept;
  writeFileSync(store(), `${JSON.stringify(all, null, 2)}\n`);
  return true;
};

export const RunConfigs = { find, groupsOf, remove, write };
