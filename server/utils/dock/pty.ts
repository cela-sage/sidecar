import { accessSync, chmodSync, constants, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawn as spawnPty, type IPty } from "node-pty";

export interface PtySpawn {
  file: string;
  args: string[];
  cwd: string;
  cols: number;
  rows: number;
  term?: string;
}

const DETACH = "\x1a";
const DETACH_MS = 3000;
const KEPT = new Set(["CLAUDE_BIN", "CLAUDE_CONFIG_DIR"]);
const DROPPED = ["CLAUDE", "DIRENV_"];

// pnpm drops the exec bit on node-pty's prebuilt helper, and posix_spawnp fails without it.
const prepare = (): void => {
  const root = dirname(createRequire(import.meta.url).resolve("node-pty/package.json"));
  const helper = join(root, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper");
  if (!existsSync(helper)) return;
  try {
    accessSync(helper, constants.X_OK);
  } catch {
    chmodSync(helper, 0o755);
  }
};

// The server's own Claude session and direnv folder are not the new shell's, and would leak into it.
const cleanEnv = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      (pair): pair is [string, string] =>
        !!pair[1] && (KEPT.has(pair[0]) || !DROPPED.some((prefix) => pair[0].startsWith(prefix))),
    ),
  );

const spawn = ({ file, args, cwd, cols, rows, term = "xterm-256color" }: PtySpawn): IPty => {
  prepare();
  return spawnPty(file, args, { name: term, cols, rows, cwd, env: { ...cleanEnv(), COLORTERM: "truecolor" } });
};

// Ctrl+Z is how `claude attach` lets go of a session and leaves it running.
const detach = (pty: IPty): Promise<void> =>
  new Promise((done) => {
    const timer = setTimeout(() => {
      pty.kill();
      done();
    }, DETACH_MS);
    pty.onExit(() => {
      clearTimeout(timer);
      done();
    });
    pty.write(DETACH);
  });

export const Pty = { detach, prepare, spawn };
