import type { ComputedRef, MaybeRefOrGetter, Ref } from "vue";
import z from "zod";
import type { Maybe } from "~/composables/useSidecar";
import type { CellRun, KernelState } from "~~/shared/types/notebook";

export interface NotebookView {
  attach: (docs: Document[]) => void;
  interrupt: () => Promise<void>;
  isRunning: ComputedRef<boolean>;
  kernel: Ref<KernelState>;
  note: Maybe<string>;
  restart: () => Promise<void>;
  runAll: () => Promise<void>;
}

interface CellState {
  count?: number;
  html?: string;
  run: CellRun;
}

const KERNEL = z.object({
  note: z.string().optional(),
  state: z.enum(["busy", "dead", "idle", "missing", "off", "starting"]),
  type: z.literal("kernel"),
});
const CELL = z.object({
  cell: z.string(),
  count: z.number().optional(),
  html: z.string().optional(),
  run: z.enum(["cancelled", "done", "failed", "queued", "running"]),
  type: z.literal("cell"),
});

const isLive = (run: CellRun): boolean => run === "queued" || run === "running";

export function useNotebook(slug: MaybeRefOrGetter<string | undefined>): NotebookView {
  const chrome = useChrome();
  const kernel = ref<KernelState>("off");
  const note = ref<string>();
  const cells = shallowRef(new Map<string, CellState>());
  let docs: Document[] = [];
  let source: EventSource | undefined;
  let unbind: (() => void)[] = [];

  const isRunning = computed(() => [...cells.value.values()].some((one) => isLive(one.run)));

  function paint(key: string, state: CellState): void {
    for (const doc of docs) {
      const cell = doc.querySelector<HTMLElement>(`[data-cell="${CSS.escape(key)}"]`);
      if (!cell) continue;
      cell.dataset.state = state.run;
      const count = cell.querySelector(".nb-count");
      if (count) count.textContent = isLive(state.run) ? "[*]" : state.count ? `[${state.count}]` : count.textContent;
      const outputs = cell.querySelector(".nb-outputs");
      if (outputs && typeof state.html === "string") outputs.innerHTML = state.html;
    }
  }

  async function post(path: string, body?: Record<string, unknown>): Promise<void> {
    const at = toValue(slug);
    if (!at) return;
    await $fetch(`/api/notebooks/${encodeURIComponent(at)}/${path}`, { body, method: "POST" }).catch((error: unknown) =>
      chrome.toast(failReason(error) ?? "The notebook did not answer", "destructive"),
    );
  }

  const run = (cell: string): Promise<void> => post("run", { cells: [cell] });

  function take(message: MessageEvent<string>): void {
    const raw: unknown = JSON.parse(message.data);
    const said = KERNEL.safeParse(raw).data;
    if (said) {
      kernel.value = said.state;
      note.value = said.note;
      return;
    }
    const cell = CELL.safeParse(raw).data;
    if (!cell) return;
    const state: CellState = { count: cell.count, html: cell.html, run: cell.run };
    cells.value = new Map(cells.value).set(cell.cell, state);
    paint(cell.cell, state);
  }

  // A reload is the file's own word, so only what is still running or queued is drawn back over it.
  function attach(next: Document[]): void {
    for (const off of unbind) off();
    unbind = [];
    docs = next;
    const kept = new Map([...cells.value].filter(([, state]) => isLive(state.run)));
    cells.value = kept;
    for (const [key, state] of kept) paint(key, state);
    for (const doc of docs) {
      const onClick = (event: MouseEvent): void => {
        const key = (event.target as Element | undefined)?.closest?.("[data-run-cell]")?.getAttribute("data-run-cell");
        if (!key) return;
        event.preventDefault();
        void run(key);
      };
      doc.addEventListener("click", onClick, true);
      unbind.push(() => doc.removeEventListener("click", onClick, true));
    }
  }

  watch(
    () => toValue(slug),
    (at) => {
      source?.close();
      source = undefined;
      cells.value = new Map();
      kernel.value = "off";
      note.value = undefined;
      if (!at) return;
      source = new EventSource(`/api/notebooks/${encodeURIComponent(at)}/stream`);
      source.addEventListener("kernel", take);
      source.addEventListener("cell", take);
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    source?.close();
    for (const off of unbind) off();
  });

  return {
    attach,
    interrupt: () => post("interrupt"),
    isRunning,
    kernel,
    note,
    restart: () => post("restart"),
    runAll: () => post("run", {}),
  };
}
