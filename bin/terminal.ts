import { setTimeout as sleep } from "node:timers/promises";
import { spawn, type IPty } from "node-pty";
import z from "zod";
import { Pty } from "../server/utils/dock/pty.ts";
import { claudeBinary } from "../server/utils/sessions/jobs.ts";

interface Held {
  key?: string;
  pty: IPty;
  isLeaving?: boolean;
}

interface Message {
  event?: string;
  data: string;
}

const RETRY_MS = 2000;
const QUIT = ["q", "\x03"];
const Attach = z.object({ key: z.string().min(1) });
const Ready = z.object({ following: z.boolean(), held: z.object({ key: z.string() }).optional() });

const parsed = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
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
  Pty.prepare();
  let held: Held | undefined;
  let queue = Promise.resolve();
  let said = "";
  let finish = (_code: number): void => {};

  const say = (line: string): void => {
    if (held || line === said) return;
    said = line;
    stdout.write(`\r\n${line}\r\n`);
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
    held = undefined;
    if (!current.key) return current.pty.kill();
    await Pty.detach(current.pty);
  };

  // Agent view is the page between conversations, so quitting it is how you stop following.
  const open = (args: string[], key?: string): void => {
    const pty = spawn(claudeBinary(), args, {
      name: process.env.TERM ?? "xterm-256color",
      cols: stdout.columns,
      rows: stdout.rows,
      cwd: process.cwd(),
      env: process.env,
    });
    const mine: Held = { pty, ...(key ? { key } : {}) };
    held = mine;
    said = "";
    pty.onData((data) => stdout.write(data));
    pty.onExit(() => {
      if (held !== mine || mine.isLeaving) return;
      held = undefined;
      if (!key) return finish(0);
      void report();
      queue = queue.then(browse);
    });
  };

  const browse = async (): Promise<void> => {
    await detach();
    open(["agents"]);
  };

  const attach = async (key: string): Promise<void> => {
    if (held?.key === key) return;
    await detach();
    open(["attach", key], key);
    await report(key);
  };

  const greet = (data: string): void => {
    if (Ready.safeParse(parsed(data)).data?.held?.key !== held?.key) void report(held?.key);
  };

  const follow = async (body: ReadableStream<Uint8Array>): Promise<void> => {
    for await (const { event, data } of messagesOf(body)) {
      if (event === "ready") greet(data);
      const key = event === "attach" ? Attach.safeParse(parsed(data)).data?.key : undefined;
      if (key) queue = queue.then(() => attach(key));
    }
  };

  const listen = async (): Promise<void> => {
    say(`Connecting to the sidecar at ${address}.`);
    for (;;) {
      const reply = await fetch(`${address}/api/attach/stream`, { headers: { accept: "text/event-stream" } }).catch(
        () => undefined,
      );
      if (reply?.ok && reply.body) await follow(reply.body).catch(() => undefined);
      say(`Waiting for the sidecar at ${address}. sidecar start brings it up.`);
      await sleep(RETRY_MS);
    }
  };

  return new Promise((resolve) => {
    finish = (code: number): void => {
      stdin.setRawMode(false);
      stdout.write("\r\n");
      void report();
      resolve(code);
    };
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.on("data", (typed: string) => {
      if (held) return held.pty.write(typed);
      if (QUIT.includes(typed)) finish(0);
    });
    stdout.on("resize", () => held?.pty.resize(stdout.columns, stdout.rows));
    queue = queue.then(browse);
    void listen();
  });
};

export const TerminalCommand = { run };
