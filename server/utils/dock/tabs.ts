import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename } from "node:path";
import type { IPty } from "node-pty";
import * as Events from "../../../lib/sidecar/events.ts";
import type { DockSize, DockTab } from "../../../shared/types/dock.ts";
import type { RunConfig } from "../../../shared/types/runs.ts";
import { RunOutput } from "../runs/failing.ts";
import { claudeBinary } from "../sessions/jobs.ts";
import { Pty } from "./pty.ts";

export interface DockViewer {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
}

export interface ShellOpening extends DockSize {
  project: string;
  folder?: string;
}

export interface SessionOpening extends DockSize {
  project: string;
  key: string;
}

export interface RunOpening extends DockSize {
  project: string;
  config: RunConfig;
}

interface Live {
  tab: DockTab;
  pty: IPty;
  backlog: string;
  viewers: Set<DockViewer>;
  retitle?: ReturnType<typeof setTimeout>;
  ended?: true;
  stopping?: true;
}

const BACKLOG = 256 * 1024;
const RETITLE_MS = 400;
const RESET = "\x1bc";
const live = new Map<string, Live>();
const starting = new Map<string, Promise<DockTab>>();

const list = (): DockTab[] => [...live.values()].map((one) => one.tab);

const changed = (): void => Events.publish({ topic: "dock.changed", key: "", data: { tabs: list() } });

// The kept tail starts on a fresh line, so a replay never opens inside an escape sequence.
const kept = (backlog: string): string => {
  if (backlog.length <= BACKLOG) return backlog;
  const from = backlog.indexOf("\n", backlog.length - BACKLOG);
  return from < 0 ? "" : backlog.slice(from + 1);
};

const retitle = (one: Live): void => {
  one.retitle = undefined;
  const title = one.pty.process;
  if (!title || title === one.tab.title) return;
  one.tab = { ...one.tab, title };
  changed();
};

// A run keeps its tab and its output once it exits, so the failure stays readable.
const finish = (one: Live, exitCode: number): void => {
  one.ended = true;
  if (one.stopping) one.tab = { ...one.tab, status: "stopped" };
  else if (exitCode === 0) one.tab = { ...one.tab, status: "passed" };
  else one.tab = { ...one.tab, status: "failed", failing: RunOutput.failingLines(one.backlog) };
};

const forget = (one: Live): void => {
  live.delete(one.tab.id);
  for (const viewer of one.viewers) viewer.close(1000, "the terminal ended");
  changed();
};

const keep = (tab: DockTab, pty: IPty, viewers = new Set<DockViewer>()): DockTab => {
  const one: Live = { tab, pty, backlog: "", viewers };
  live.set(tab.id, one);
  pty.onData((data) => {
    if (live.get(tab.id) !== one) return;
    one.backlog = kept(one.backlog + data);
    for (const viewer of one.viewers) viewer.send(data);
    if (tab.kind === "shell" && !one.retitle) one.retitle = setTimeout(() => retitle(one), RETITLE_MS);
  });
  pty.onExit(({ exitCode }) => {
    clearTimeout(one.retitle);
    if (live.get(tab.id) !== one) return;
    if (tab.kind !== "run") return forget(one);
    finish(one, exitCode);
    changed();
  });
  changed();
  return tab;
};

const shell = ({ project, folder, cols, rows }: ShellOpening): DockTab => {
  const file = process.env.SHELL || "/bin/zsh";
  const cwd = folder && existsSync(folder) ? folder : homedir();
  const pty = Pty.spawn({ file, args: ["-l"], cwd, cols, rows });
  return keep({ id: randomUUID(), project, kind: "shell", title: basename(file) }, pty);
};

const holding = (key: string): Live | undefined => [...live.values()].find((one) => one.tab.key === key);

const session = ({ project, key, cols, rows }: SessionOpening): DockTab => {
  const held = holding(key);
  if (held) return held.tab;
  const pty = Pty.spawn({ file: claudeBinary(), args: ["attach", key], cwd: homedir(), cols, rows });
  return keep({ id: randomUUID(), project, kind: "session", title: key, key }, pty);
};

const runOf = (project: string, config: string): Live | undefined =>
  [...live.values()].find((one) => one.tab.project === project && one.tab.config === config);

const stopping = async (one: Live): Promise<void> => {
  if (one.ended) return;
  one.stopping = true;
  await Pty.interrupt(one.pty);
};

// A rerun takes the old run's tab and viewers, and waits for it to end so a dev server's port is free again.
const rerun = async ({ project, config, cols, rows }: RunOpening): Promise<DockTab> => {
  const before = runOf(project, config.id);
  if (before) await stopping(before);
  for (const viewer of before?.viewers ?? []) viewer.send(RESET);
  const file = process.env.SHELL || "/bin/zsh";
  const cwd = existsSync(config.folder) ? config.folder : homedir();
  const pty = Pty.spawn({ file, args: ["-l", "-c", config.command], cwd, cols, rows });
  const tab: DockTab = {
    id: before?.tab.id ?? randomUUID(),
    project,
    kind: "run",
    title: config.name,
    config: config.id,
    status: "running",
  };
  return keep(tab, pty, before?.viewers);
};

const run = (opening: RunOpening): Promise<DockTab> => {
  const at = `${opening.project}\n${opening.config.id}`;
  const pending = starting.get(at) ?? rerun(opening).finally(() => starting.delete(at));
  starting.set(at, pending);
  return pending;
};

const stop = async (id: string): Promise<boolean> => {
  const one = live.get(id);
  if (one?.tab.kind !== "run") return false;
  await stopping(one);
  return true;
};

const release = async (key: string): Promise<void> => {
  const held = holding(key);
  if (held) await Pty.detach(held.pty);
};

const join = (id: string, viewer: DockViewer): boolean => {
  const one = live.get(id);
  if (!one) return false;
  one.viewers.add(viewer);
  if (one.backlog) viewer.send(one.backlog);
  return true;
};

const leave = (id: string, viewer: DockViewer): void => {
  live.get(id)?.viewers.delete(viewer);
};

const write = (id: string, data: string): void => {
  const one = live.get(id);
  if (one && !one.ended) one.pty.write(data);
};

const resize = (id: string, { cols, rows }: DockSize): void => {
  const one = live.get(id);
  if (one && !one.ended) one.pty.resize(cols, rows);
};

export const DockTabs = { join, leave, list, release, resize, run, session, shell, stop, write };
