import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import z from "zod";
import type { KernelState, NotebookEvent } from "../../../shared/types/notebook.ts";
import { Watched } from "../watched.ts";
import { type Notebook, NotebookFormat, type NotebookOutput } from "./format.ts";
import { Jupyter, type JupyterKernel, type JupyterMessage, JupyterUnavailable } from "./jupyter.ts";
import { NotebookPage } from "./page.ts";

interface Active {
  cell: string;
  clearOnNext: boolean;
  count?: number;
  displays: Map<string, number[]>;
  failed: boolean;
  idle: boolean;
  kernel: string;
  msgId: string;
  outputs: NotebookOutput[];
  replied: boolean;
}

interface Book {
  active?: Active;
  connection?: Promise<JupyterKernel>;
  flush?: ReturnType<typeof setTimeout>;
  isPumping: boolean;
  note?: string;
  path: string;
  queue: string[];
  state: KernelState;
}

const FLUSH_MS = 80;

const Bundle = z.record(z.string(), z.unknown());
const Shown = z.object({
  data: Bundle,
  metadata: Bundle.default({}),
  transient: z.object({ display_id: z.string().optional() }).optional(),
});
const Content = {
  clear: z.object({ wait: z.boolean().default(false) }),
  count: z.object({ execution_count: z.number().nullable() }), // external contract: Jupyter messaging
  error: z.object({ ename: z.string(), evalue: z.string(), traceback: z.array(z.string()) }),
  reply: z.object({ execution_count: z.number().nullable().optional(), status: z.string() }), // external contract
  result: Shown.extend({ execution_count: z.number().nullable() }), // external contract: Jupyter messaging
  shown: Shown,
  status: z.object({ execution_state: z.string() }),
  stream: z.object({ name: z.string(), text: z.string() }),
};

const books = new Map<string, Book>();
const events = new EventEmitter<{ event: [path: string, event: NotebookEvent] }>().setMaxListeners(0);

const tell = (book: Book, event: NotebookEvent): boolean => events.emit("event", book.path, event);

function bookOf(path: string): Book {
  const held = books.get(path);
  if (held) return held;
  const book: Book = { isPumping: false, path, queue: [], state: "off" };
  books.set(path, book);
  return book;
}

function setState(book: Book, state: KernelState, note?: string): void {
  if (book.state === state && book.note === note) return;
  book.state = state;
  book.note = note;
  tell(book, { note, state, type: "kernel" });
}

async function read(path: string): Promise<Notebook> {
  const notebook = NotebookFormat.parse(await readFile(path, "utf8"));
  if (!notebook) throw new Error(`${path} is not a notebook the sidecar can read`);
  return notebook;
}

const indexOf = (notebook: Notebook, key: string): number =>
  notebook.cells.findIndex((cell, index) => NotebookFormat.keyOf(cell, index) === key);

// A progress bar redraws its line with a carriage return, and only what it drew last is on screen.
const settle = (text: string): string =>
  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.split("\r").findLast(Boolean) ?? "")
    .join("\n");

const OUTPUT: Record<string, (active: Active, content: Record<string, unknown>) => void> = {
  clear_output: (active, content) => {
    if (Content.clear.parse(content).wait) active.clearOnNext = true;
    else active.outputs = [];
  },
  display_data: (active, content) => {
    const { data, metadata, transient } = Content.shown.parse(content);
    const at = active.outputs.push({ data, metadata, output_type: "display_data" }) - 1;
    const id = transient?.display_id;
    if (id) active.displays.set(id, [...(active.displays.get(id) ?? []), at]);
  },
  error: (active, content) => {
    active.failed = true;
    active.outputs.push({ ...Content.error.parse(content), output_type: "error" });
  },
  execute_input: (active, content) => {
    active.count = Content.count.parse(content).execution_count ?? undefined;
  },
  execute_result: (active, content) => {
    const { data, execution_count, metadata } = Content.result.parse(content);
    active.outputs.push({ data, execution_count, metadata, output_type: "execute_result" });
  },
  stream: (active, content) => {
    const { name, text } = Content.stream.parse(content);
    const last = active.outputs.at(-1);
    if (last?.output_type === "stream" && "name" in last && last.name === name && typeof last.text === "string")
      last.text = settle(last.text + text);
    else active.outputs.push({ name, output_type: "stream", text: settle(text) });
  },
  update_display_data: (active, content) => {
    const { data, metadata, transient } = Content.shown.parse(content);
    for (const at of active.displays.get(transient?.display_id ?? "") ?? [])
      active.outputs[at] = { data, metadata, output_type: "display_data" };
  },
};

// nbformat keeps text as a list of lines, so a saved run diffs line by line like Jupyter's own.
function stored(output: NotebookOutput): NotebookOutput {
  if (output.output_type === "stream" && typeof output.text === "string")
    return { ...output, text: NotebookFormat.linesOf(output.text) };
  if (!("data" in output) || typeof output.data !== "object" || !output.data) return output;
  const data = Object.fromEntries(
    Object.entries(output.data).map(([mime, value]) => [
      mime,
      typeof value === "string" && (mime.startsWith("text/") || mime.endsWith("+xml"))
        ? NotebookFormat.linesOf(value)
        : value,
    ]),
  );
  return { ...output, data };
}

async function save(path: string, { cell, count, outputs }: Active): Promise<void> {
  const notebook = await read(path);
  const target = notebook.cells[indexOf(notebook, cell)];
  if (!target || !NotebookFormat.isCode(target)) return;
  target.outputs = outputs.map(stored);
  target.execution_count = count ?? null; // external contract: nbformat
  await writeFile(path, NotebookFormat.write(notebook));
  Watched.own(path, await Watched.signatureOf(path));
}

function cancelQueue(book: Book): void {
  for (const cell of book.queue.splice(0)) tell(book, { cell, run: "cancelled", type: "cell" });
}

function flush(book: Book): void {
  if (book.flush) return;
  book.flush = setTimeout(async () => {
    book.flush = undefined;
    const active = book.active;
    if (!active) return;
    const html = await NotebookPage.outputs(active.outputs);
    if (book.active === active)
      tell(book, { cell: active.cell, count: active.count, html, run: "running", type: "cell" });
  }, FLUSH_MS);
}

async function finish(book: Book): Promise<void> {
  const active = book.active;
  if (!active?.idle || !active.replied) return;
  book.active = undefined;
  clearTimeout(book.flush);
  book.flush = undefined;
  await save(book.path, active).catch((error: unknown) =>
    console.error(`[notebooks] could not save the outputs of ${active.cell} in ${book.path}`, error),
  );
  const html = await NotebookPage.outputs(active.outputs);
  tell(book, { cell: active.cell, count: active.count, html, run: active.failed ? "failed" : "done", type: "cell" });
  if (active.failed) cancelQueue(book);
  void pump(book, active.kernel);
}

function receive(book: Book, { content, msgType, parent }: JupyterMessage): void {
  const active = book.active;
  if (msgType === "status") {
    const { execution_state } = Content.status.parse(content);
    if (execution_state === "busy" || execution_state === "idle" || execution_state === "starting")
      setState(book, execution_state);
    if (active && (execution_state === "restarting" || execution_state === "dead")) {
      book.active = undefined;
      tell(book, { cell: active.cell, run: "failed", type: "cell" });
      cancelQueue(book);
      setState(book, "starting", "The kernel died and is restarting");
      return;
    }
    if (active && parent === active.msgId && execution_state === "idle") {
      active.idle = true;
      void finish(book);
    }
    return;
  }
  if (!active || parent !== active.msgId) return;
  if (msgType === "execute_reply") {
    const reply = Content.reply.parse(content);
    active.replied = true;
    active.failed ||= reply.status !== "ok";
    active.count = reply.execution_count ?? active.count;
    void finish(book);
    return;
  }
  const handle = OUTPUT[msgType];
  if (!handle) return;
  if (active.clearOnNext && msgType !== "clear_output" && msgType !== "execute_input") {
    active.outputs = [];
    active.clearOnNext = false;
  }
  handle(active, content);
  flush(book);
}

function lost(book: Book): void {
  book.connection = undefined;
  const active = book.active;
  book.active = undefined;
  if (active) tell(book, { cell: active.cell, run: "failed", type: "cell" });
  cancelQueue(book);
  setState(book, "off", "The kernel stopped. Running a cell starts a new one.");
}

function connect(book: Book, kernel: string): Promise<JupyterKernel> {
  book.connection ??= Jupyter.open({
    kernel,
    onClose: () => lost(book),
    onMessage: (message) => receive(book, message),
    path: book.path,
  }).catch((error: unknown) => {
    book.connection = undefined;
    throw error;
  });
  return book.connection;
}

async function pump(book: Book, kernel: string): Promise<void> {
  if (book.active || book.isPumping) return;
  book.isPumping = true;
  try {
    while (!book.active && book.queue.length) {
      if (!book.connection) setState(book, "starting");
      const connection = await connect(book, kernel);
      const notebook = await read(book.path);
      const cell = book.queue.shift() ?? "";
      const target = notebook.cells[indexOf(notebook, cell)];
      if (!target || !NotebookFormat.isCode(target)) {
        tell(book, { cell, run: "cancelled", type: "cell" });
        continue;
      }
      const msgId = connection.execute(NotebookFormat.textOf(target.source));
      book.active = {
        cell,
        clearOnNext: false,
        displays: new Map(),
        failed: false,
        idle: false,
        kernel,
        msgId,
        outputs: [],
        replied: false,
      };
      tell(book, { cell, html: "", run: "running", type: "cell" });
    }
  } catch (error) {
    const missing = error instanceof JupyterUnavailable;
    const reason = error instanceof Error ? error.message : String(error);
    if (!missing) console.error(`[notebooks] could not run ${book.path}`, error);
    cancelQueue(book);
    setState(book, missing ? "missing" : "dead", missing ? reason : `The kernel could not start: ${reason}`);
  } finally {
    book.isPumping = false;
  }
}

async function run(path: string, cells?: string[]): Promise<void> {
  const book = bookOf(path);
  const notebook = await read(path);
  const code = notebook.cells.flatMap((cell, index) =>
    NotebookFormat.isCode(cell) ? [NotebookFormat.keyOf(cell, index)] : [],
  );
  for (const cell of cells ? cells.filter((one) => code.includes(one)) : code) {
    if (book.queue.includes(cell) || book.active?.cell === cell) continue;
    book.queue.push(cell);
    tell(book, { cell, run: "queued", type: "cell" });
  }
  void pump(book, NotebookFormat.kernelOf(notebook));
}

async function interrupt(path: string): Promise<void> {
  const book = bookOf(path);
  cancelQueue(book);
  await (await book.connection)?.interrupt();
}

async function restart(path: string): Promise<void> {
  const book = bookOf(path);
  cancelQueue(book);
  const active = book.active;
  book.active = undefined;
  if (active) tell(book, { cell: active.cell, run: "cancelled", type: "cell" });
  const connection = await book.connection;
  if (!connection) return;
  setState(book, "starting");
  await connection.restart();
}

async function snapshot(path: string): Promise<NotebookEvent[]> {
  const book = bookOf(path);
  const active = book.active;
  const running: NotebookEvent[] = active
    ? [
        {
          cell: active.cell,
          count: active.count,
          html: await NotebookPage.outputs(active.outputs),
          run: "running",
          type: "cell",
        },
      ]
    : [];
  return [
    { note: book.note, state: book.state, type: "kernel" },
    ...running,
    ...book.queue.map((cell): NotebookEvent => ({ cell, run: "queued", type: "cell" })),
  ];
}

function on(path: string, handler: (event: NotebookEvent) => void): () => void {
  const listener = (at: string, event: NotebookEvent): void => {
    if (at === path) handler(event);
  };
  events.on("event", listener);
  return () => events.off("event", listener);
}

async function stopAll(): Promise<void> {
  for (const book of books.values()) (await book.connection?.catch(() => undefined))?.close();
  books.clear();
  await Jupyter.stop();
}

export const NotebookRuns = { interrupt, on, restart, run, snapshot, stopAll };
