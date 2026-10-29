import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename } from "node:path";
import type { IPty } from "node-pty";
import * as Events from "../../../lib/sidecar/events.ts";
import type { DockSize, DockTab } from "../../../shared/types/dock.ts";
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

interface Live {
  tab: DockTab;
  pty: IPty;
  backlog: string;
  viewers: Set<DockViewer>;
  retitle?: ReturnType<typeof setTimeout>;
}

const BACKLOG = 256 * 1024;
const RETITLE_MS = 400;
const live = new Map<string, Live>();

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

const keep = (tab: DockTab, pty: IPty): DockTab => {
  const one: Live = { tab, pty, backlog: "", viewers: new Set() };
  live.set(tab.id, one);
  pty.onData((data) => {
    one.backlog = kept(one.backlog + data);
    for (const viewer of one.viewers) viewer.send(data);
    if (tab.kind === "shell" && !one.retitle) one.retitle = setTimeout(() => retitle(one), RETITLE_MS);
  });
  pty.onExit(() => {
    clearTimeout(one.retitle);
    live.delete(tab.id);
    for (const viewer of one.viewers) viewer.close(1000, "the terminal ended");
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

const write = (id: string, data: string): void => live.get(id)?.pty.write(data);

const resize = (id: string, { cols, rows }: DockSize): void => live.get(id)?.pty.resize(cols, rows);

export const DockTabs = { join, leave, list, release, resize, session, shell, write };
