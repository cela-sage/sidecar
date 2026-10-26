import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { basename } from "node:path";
import z from "zod";

export interface JupyterMessage {
  channel: string;
  content: Record<string, unknown>;
  msgType: string;
  parent?: string;
}

export interface JupyterKernel {
  close: () => void;
  execute: (code: string) => string;
  id: string;
  interrupt: () => Promise<void>;
  restart: () => Promise<void>;
}

export interface JupyterKernelOptions {
  kernel: string;
  onClose: () => void;
  onMessage: (message: JupyterMessage) => void;
  path: string;
}

interface Server {
  base: string;
  child: ChildProcess;
  token: string;
}

export class JupyterUnavailable extends Error {}

const READY_MS = 30_000;
// Culled after an hour idle, so a server the sidecar never got to stop does not outlive it for long.
const IDLE_S = "3600";

const Wire = z.object({
  channel: z.string(),
  content: z.record(z.string(), z.unknown()),
  header: z.object({ msg_type: z.string() }),
  parent_header: z.object({ msg_id: z.string().optional() }).optional(),
});
const Session = z.object({ id: z.string(), kernel: z.object({ id: z.string() }) });

let server: Promise<Server> | undefined;

const freePort = (): Promise<number> =>
  new Promise((done, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const at = probe.address();
      probe.close(() => (typeof at === "object" && at ? done(at.port) : fail(new Error("no free port"))));
    });
  });

function unavailable(python: string, said: string): JupyterUnavailable {
  if (/No module named/.test(said))
    return new JupyterUnavailable(`Running needs Jupyter in ${python}: pip install jupyter_server ipykernel`);
  const last = said.trim().split("\n").at(-1);
  return new JupyterUnavailable(last ? `Jupyter did not start: ${last}` : "Jupyter did not start");
}

async function ready({ base, token }: Pick<Server, "base" | "token">): Promise<void> {
  const until = Date.now() + READY_MS;
  while (Date.now() < until) {
    const up = await fetch(`${base}/api/status`, { headers: { authorization: `token ${token}` } }).catch(
      () => undefined,
    );
    if (up?.ok) return;
    await new Promise((wake) => setTimeout(wake, 150));
  }
  throw new JupyterUnavailable("Jupyter did not answer in time");
}

async function boot(): Promise<Server> {
  const python = process.env.SIDECAR_PYTHON || "python3";
  const port = await freePort();
  const token = randomBytes(24).toString("hex");
  const child = spawn(
    python,
    [
      "-m",
      "jupyter_server",
      "--no-browser",
      "--ServerApp.ip=127.0.0.1",
      `--ServerApp.port=${port}`,
      "--ServerApp.port_retries=0",
      `--IdentityProvider.token=${token}`,
      "--ServerApp.root_dir=/",
      `--ServerApp.shutdown_no_activity_timeout=${IDLE_S}`,
      `--MappingKernelManager.cull_idle_timeout=${IDLE_S}`,
      "--MappingKernelManager.cull_interval=300",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let said = "";
  child.stderr?.on("data", (chunk: Buffer) => (said = `${said}${chunk}`.slice(-4000)));
  const base = `http://127.0.0.1:${port}`;
  const ended = new Promise<never>((_, fail) => {
    child.once("error", () => fail(new JupyterUnavailable(`${python} was not found, so a notebook cannot run`)));
    child.once("exit", () => fail(unavailable(python, said)));
  });
  await Promise.race([ready({ base, token }), ended]);
  child.once("exit", () => (server = undefined));
  console.info(`[notebooks] Jupyter is up on ${base}`);
  return { base, child, token };
}

function up(): Promise<Server> {
  server ??= boot().catch((error: unknown) => {
    server = undefined;
    throw error;
  });
  return server;
}

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const { base, token } = await up();
  const reply = await fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `token ${token}`, "content-type": "application/json" },
  });
  if (!reply.ok) throw new Error(`Jupyter answered ${reply.status} to ${path}`);
  return reply.status === 204 ? undefined : reply.json();
}

function parse(raw: unknown): JupyterMessage | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const wire = Wire.safeParse(JSON.parse(raw)).data;
    return (
      wire && {
        channel: wire.channel,
        content: wire.content,
        msgType: wire.header.msg_type,
        parent: wire.parent_header?.msg_id,
      }
    );
  } catch {
    return undefined;
  }
}

// The kernel's folder is the notebook's own, so a relative read in a cell finds the files beside it.
async function open({ kernel, onClose, onMessage, path }: JupyterKernelOptions): Promise<JupyterKernel> {
  const { base, token } = await up();
  const session = Session.parse(
    await call("/api/sessions", {
      body: JSON.stringify({ kernel: { name: kernel }, name: basename(path), path: path.slice(1), type: "notebook" }),
      method: "POST",
    }),
  );
  const id = session.kernel.id;
  const client = randomUUID();
  const socket = new WebSocket(
    `${base.replace(/^http/, "ws")}/api/kernels/${id}/channels?session_id=${client}&token=${token}`,
  );
  await new Promise<void>((done, fail) => {
    socket.addEventListener("open", () => done(), { once: true });
    socket.addEventListener("error", () => fail(new Error("the kernel channel did not open")), { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = parse(event.data);
    if (message) onMessage(message);
  });
  socket.addEventListener("close", onClose, { once: true });

  const execute = (code: string): string => {
    const msgId = randomUUID();
    const header = { date: new Date().toISOString(), msg_id: msgId, msg_type: "execute_request", session: client };
    socket.send(
      JSON.stringify({
        buffers: [],
        channel: "shell",
        content: {
          allow_stdin: false,
          code,
          silent: false,
          stop_on_error: true,
          store_history: true,
          user_expressions: {},
        },
        header: { ...header, username: "sidecar", version: "5.3" },
        metadata: {},
        parent_header: {},
      }),
    );
    return msgId;
  };

  return {
    close: () => {
      socket.close();
      void call(`/api/sessions/${session.id}`, { method: "DELETE" }).catch(() => undefined);
    },
    execute,
    id,
    interrupt: async () => void (await call(`/api/kernels/${id}/interrupt`, { method: "POST" })),
    restart: async () => void (await call(`/api/kernels/${id}/restart`, { method: "POST" })),
  };
}

async function stop(): Promise<void> {
  const held = await server?.catch(() => undefined);
  server = undefined;
  held?.child.kill();
}

export const Jupyter = { open, stop };
