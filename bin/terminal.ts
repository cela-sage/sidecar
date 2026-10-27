import { accessSync, chmodSync, constants, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { spawn, type IPty } from "node-pty";
import z from "zod";
import { claudeBinary } from "../server/utils/sessions/jobs.ts";

interface Held {
  key: string;
  pty: IPty;
  isLeaving?: boolean;
}

interface Message {
  event?: string;
  data: string;
}

const DETACH = "\x1a";
const DETACH_MS = 3000;
const RETRY_MS = 2000;
const QUIT = ["q", "\x03"];
const Attach = z.object({ key: z.string().min(1) });

const keyOf = ({ event, data }: Message): string | undefined => {
  if (event !== "attach") return undefined;
  try {
    return Attach.safeParse(JSON.parse(data)).data?.key;
  } catch {
    return undefined;
  }
};

const executableHelper = (): void => {
  const root = dirname(createRequire(import.meta.url).resolve("node-pty/package.json"));
  const helper = join(root, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper");
  if (!existsSync(helper)) return;
  try {
    accessSync(helper, constants.X_OK);
  } catch {
    chmodSync(helper, 0o755);
  }
};

async function* messagesOf(body: ReadableStream<Uint8Array>): AsyncGenerator<Message> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true }).replace(/\r\n/g, "\n");
    for (let at = buffer.indexOf("\n\n"); at >= 0; at = buffer.indexOf("\n\n")) {
      const lines = buffer.slice(0, at).split("\n");
      buffer = buffer.slice(at + 2);
      const field = (name: string): string =>
        lines
          .filter((line) => line.startsWith(`${name}:`))
          .map((line) => line.slice(name.length + 1).trimStart())
          .join("\n");
      yield { event: field("event") || undefined, data: field("data") };
    }
  }
}

const run = (address: string): Promise<number> => {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdout.isTTY) {
    console.error("sidecar terminal runs in a terminal, the one you use for Claude Code");
    return Promise.resolve(2);
  }
  executableHelper();
  let held: Held | undefined;
  let queue = Promise.resolve();

  const say = (line: string): void => {
    if (!held) stdout.write(`\r\n${line}\r\n`);
  };

  const report = (key?: string): Promise<unknown> =>
    fetch(`${address}/api/attach/held`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(key ? { key } : {}),
    }).catch(() => undefined);

  const detach = async (): Promise<void> => {
    const current = held;
    if (!current) return;
    current.isLeaving = true;
    const exited = new Promise<void>((resolve) => current.pty.onExit(() => resolve()));
    current.pty.write(DETACH);
    await Promise.race([exited, sleep(DETACH_MS)]);
    current.pty.kill();
    held = undefined;
  };

  const attach = async (key: string): Promise<void> => {
    if (held?.key === key) return;
    await detach();
    const pty = spawn(claudeBinary(), ["attach", key], {
      name: process.env.TERM ?? "xterm-256color",
      cols: stdout.columns,
      rows: stdout.rows,
      cwd: process.cwd(),
      env: process.env,
    });
    const mine: Held = { key, pty };
    held = mine;
    pty.onData((data) => stdout.write(data));
    pty.onExit(() => {
      if (held !== mine || mine.isLeaving) return;
      held = undefined;
      void report();
      say("Detached. The sidecar's Attach opens the next one here, q stops following.");
    });
    await report(key);
  };

  const follow = async (body: ReadableStream<Uint8Array>): Promise<void> => {
    for await (const message of messagesOf(body)) {
      const key = keyOf(message);
      if (key) queue = queue.then(() => attach(key));
    }
  };

  const listen = async (): Promise<void> => {
    for (;;) {
      const reply = await fetch(`${address}/api/attach/stream`, { headers: { accept: "text/event-stream" } }).catch(
        () => undefined,
      );
      if (reply?.ok && reply.body) {
        say(`Following the sidecar at ${address}. Attach a conversation from a task, q stops following.`);
        void report(held?.key);
        await follow(reply.body).catch(() => undefined);
      }
      say(`Waiting for the sidecar at ${address}. sidecar start brings it up.`);
      await sleep(RETRY_MS);
    }
  };

  return new Promise((resolve) => {
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.on("data", (typed: string) => {
      if (held) return held.pty.write(typed);
      if (!QUIT.includes(typed)) return;
      stdin.setRawMode(false);
      stdout.write("\r\n");
      resolve(0);
    });
    stdout.on("resize", () => held?.pty.resize(stdout.columns, stdout.rows));
    void listen();
  });
};

export const TerminalCommand = { run };
