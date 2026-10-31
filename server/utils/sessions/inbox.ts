import { createConnection } from "node:net";
import { readTextSafe } from "../../../lib/files.ts";
import { keyOf } from "./paths.ts";
import { entryOf, keyFileOf, liveEntries, type RegistryEntry } from "./registry.ts";
import { marked, recorded, senderOf } from "./relay.ts";
import { wake } from "./wake.ts";

const HANG_BUDGET_MS = 2000;

export type SendOptions = {
  socketPath: string;
  token: string;
  text: string;
  slug?: string;
  from?: string;
  isRelay?: boolean;
};

export type SendResult = { ok: true } | { ok: false };

export type DeliverOptions = Omit<SendOptions, "socketPath" | "token"> & { key: string; canWake?: boolean };

// no-live-session means no process ran under the key and none could be woken.
export type DeliverResult =
  { delivered: true; session: string } | { delivered: false; reason: "no-live-session" | "refused-by-inbox" };

const woken = async (key: string): Promise<RegistryEntry | undefined> => {
  const isUp = await wake(key).catch((error: unknown) => {
    console.error(`[wake] could not resume ${key}`, error);
    return false;
  });
  return isUp ? entryOf(key) : undefined;
};

// A passive ask, such as the command list or a stop, passes canWake: false so it never starts a process.
export async function deliver({ key, canWake = true, ...sent }: DeliverOptions): Promise<DeliverResult> {
  const entry = entryOf(key) ?? (canWake ? await woken(key) : undefined);
  if (!entry) return { delivered: false, reason: "no-live-session" };
  const token = readTextSafe(keyFileOf(entry.pid))?.trim();
  if (!entry.messagingSocketPath || !token) return { delivered: false, reason: "refused-by-inbox" };
  const result = await sendToInbox({ socketPath: entry.messagingSocketPath, token, ...sent });
  return result.ok ? { delivered: true, session: keyOf(entry.id) } : { delivered: false, reason: "refused-by-inbox" };
}

const recipientOf = (socketPath: string): string | undefined => {
  const entry = liveEntries().find((one) => one.messagingSocketPath === socketPath);
  return entry && keyOf(entry.id);
};

// Nitro auto-imports every server util, so a bare `send` would shadow h3's own response helper.
export function sendToInbox({
  socketPath,
  token,
  text,
  slug,
  from = senderOf(),
  isRelay = true,
}: SendOptions): Promise<SendResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const socket = createConnection({ path: socketPath });
    const finish = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!ok) socket.destroy();
      resolve(ok ? { ok: true } : { ok: false });
    };
    // A vanished listener leaves the socket file behind; two seconds is the hang budget.
    timer = setTimeout(() => finish(false), HANG_BUDGET_MS);
    socket.on("error", () => finish(false));
    socket.on("connect", () => {
      const auth = JSON.stringify({ type: "auth", token });
      const user = JSON.stringify({ type: "user", message: { role: "user", content: marked({ text, slug, from }) } });
      socket.write(`${auth}\n${user}\n`, (error) => {
        socket.end();
        if (!error && from && isRelay) recorded({ from, to: recipientOf(socketPath), text, slug });
        finish(!error);
      });
    });
  });
}
