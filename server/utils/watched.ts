import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFile, stat } from "node:fs/promises";
import { type FSWatcher, watch } from "chokidar";

export interface FileChange {
  hash: string;
  /** The sidecar wrote it, so what is on screen already shows it. */
  isOwn: boolean;
  path: string;
}

// Hashing a long video on every change would cost more than reloading it, so a large file is known by its size and time.
const HASH_LIMIT = 8 * 1024 * 1024;

const changes = new EventEmitter<{ changed: [FileChange] }>().setMaxListeners(0);
const holds = new Map<string, number>();
const owned = new Map<string, string>();
let watcher: FSWatcher | undefined;

async function signatureOf(path: string): Promise<string> {
  const { mtimeMs, size } = await stat(path);
  if (size > HASH_LIMIT) return `${size}:${mtimeMs}`;
  return createHash("sha1")
    .update(await readFile(path))
    .digest("hex");
}

async function announce(path: string): Promise<void> {
  const hash = await signatureOf(path).catch(() => "");
  if (!hash) return;
  changes.emit("changed", { hash, isOwn: owned.get(path) === hash, path });
}

function watcherOf(): FSWatcher {
  watcher ??= watch([], { awaitWriteFinish: { pollInterval: 40, stabilityThreshold: 120 }, ignoreInitial: true })
    .on("change", (path) => void announce(path))
    .on("add", (path) => void announce(path))
    .on("error", (error) => console.error("[watched] a file watch failed", error));
  return watcher;
}

function hold(path: string, onChange: (change: FileChange) => void): () => void {
  const held = holds.get(path) ?? 0;
  holds.set(path, held + 1);
  if (!held) watcherOf().add(path);
  const listener = (change: FileChange): void => {
    if (change.path === path) onChange(change);
  };
  changes.on("changed", listener);
  return () => {
    changes.off("changed", listener);
    const left = (holds.get(path) ?? 1) - 1;
    if (left) return void holds.set(path, left);
    holds.delete(path);
    owned.delete(path);
    watcher?.unwatch(path);
  };
}

function own(path: string, hash: string): void {
  owned.set(path, hash);
}

async function close(): Promise<void> {
  await watcher?.close();
  watcher = undefined;
}

export const Watched = { close, hold, own, signatureOf };
