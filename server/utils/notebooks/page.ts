import { AnsiUp } from "ansi_up";
import { Syntax } from "../../../shared/utils/highlight.ts";
import { Markdown } from "../markdown.ts";
import { type KnownOutput, type Notebook, type NotebookCell, NotebookFormat, type NotebookOutput } from "./format.ts";

// Jupyter's own order of preference, richest first, so a DataFrame draws as its table rather than its repr.
const MIMES = [
  "text/html",
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/gif",
  "text/markdown",
  "text/latex",
  "application/json",
  "text/plain",
] as const;

type Mime = (typeof MIMES)[number];

const PLAY = '<svg class="nb-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z"/></svg>';
const SPIN = '<svg class="nb-spin" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/></svg>';

const CSS = `.page{max-width:var(--measure-wide,920px)}
.nb-cell+.nb-cell{margin-top:20px}
.nb-code{display:grid;grid-template-columns:36px minmax(0,1fr);column-gap:10px}
.nb-gutter{display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:9px}
.nb-run{display:grid;place-items:center;width:26px;height:26px;padding:0;border:1px solid var(--border);border-radius:50%;background:var(--surface);color:var(--muted);cursor:pointer;transition:color .15s ease-out,border-color .15s ease-out}
.nb-run:hover{border-color:var(--accent);color:var(--accent)}
.nb-run svg{width:14px;height:14px}
.nb-play{fill:currentColor}
.nb-spin{display:none;fill:none;stroke:currentColor;stroke-width:2;stroke-dasharray:22 12;animation:nb-turn .9s linear infinite}
.nb-cell[data-state=running] .nb-play,.nb-cell[data-state=queued] .nb-play{display:none}
.nb-cell[data-state=running] .nb-spin,.nb-cell[data-state=queued] .nb-spin{display:block}
.nb-cell[data-state=queued] .nb-spin{animation:none;stroke-dasharray:2 3}
.nb-cell[data-state=running] .nb-run{border-color:var(--accent);color:var(--accent)}
.nb-count{font-family:var(--mono);font-size:11px;color:var(--faint);white-space:nowrap}
.nb-cell[data-state=failed] .nb-count{color:var(--bad)}
.nb-source{margin:0}
.nb-outputs{grid-column:2;min-width:0}
.nb-outputs:empty{display:none}
.nb-out{margin-top:10px;overflow-x:auto}
.nb-out pre{margin:0;padding:0;border:0;background:none;white-space:pre-wrap;word-break:break-word}
.nb-out[data-name=stderr]{border-radius:var(--radius-sm);background:var(--warn-soft);padding:8px 12px}
.nb-out[data-kind=error] pre{color:var(--bad)}
.nb-out img,.nb-out svg{display:block;max-width:100%;height:auto}
.nb-out table{border-collapse:collapse;font-size:.85em;font-variant-numeric:tabular-nums}
.nb-out th,.nb-out td{border-bottom:1px solid var(--border);padding:4px 10px;text-align:right;white-space:nowrap}
.nb-out thead th{color:var(--muted);font-weight:600}
.nb-raw{color:var(--muted)}
.shj-syn-kwd,.shj-syn-section{color:var(--accent)}
.shj-syn-str,.shj-syn-insert{color:var(--ok)}
.shj-syn-num,.shj-syn-esc,.shj-syn-bool{color:var(--warn)}
.shj-syn-func,.shj-syn-class,.shj-syn-type{color:var(--info)}
.shj-syn-cmnt{color:var(--faint);font-style:italic}
.shj-syn-err,.shj-syn-deleted{color:var(--bad)}
.ansi-black-fg,.ansi-bright-black-fg{color:var(--faint)}
.ansi-red-fg,.ansi-bright-red-fg{color:var(--bad)}
.ansi-green-fg,.ansi-bright-green-fg{color:var(--ok)}
.ansi-yellow-fg,.ansi-bright-yellow-fg{color:var(--warn)}
.ansi-blue-fg,.ansi-bright-blue-fg,.ansi-cyan-fg,.ansi-bright-cyan-fg{color:var(--info)}
.ansi-magenta-fg,.ansi-bright-magenta-fg{color:var(--accent)}
.ansi-red-bg{background:var(--bad-soft)}
.ansi-green-bg{background:var(--ok-soft)}
.ansi-yellow-bg{background:var(--warn-soft)}
@keyframes nb-turn{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.nb-spin{animation:none}}`;

const escape = Markdown.escape;

const ansi = (text: string): string => {
  const up = new AnsiUp();
  up.use_classes = true;
  return up.ansi_to_html(text);
};

const textOf = (value: unknown): string =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.filter((one) => typeof one === "string").join("")
      : "";

const base64Of = (value: unknown): string => textOf(value).replace(/\s/g, "");

const RENDER: Record<Mime, (data: unknown) => Promise<string> | string> = {
  "text/html": (data) => `<div class="nb-html">${textOf(data)}</div>`,
  "image/svg+xml": (data) => textOf(data),
  "image/png": (data) => `<img alt="" src="data:image/png;base64,${base64Of(data)}">`,
  "image/jpeg": (data) => `<img alt="" src="data:image/jpeg;base64,${base64Of(data)}">`,
  "image/gif": (data) => `<img alt="" src="data:image/gif;base64,${base64Of(data)}">`,
  "text/markdown": (data) => Markdown.body(textOf(data)),
  "text/latex": (data) => `<pre>${escape(textOf(data))}</pre>`,
  "application/json": (data) => `<pre>${escape(JSON.stringify(data, undefined, 2))}</pre>`,
  "text/plain": (data) => `<pre>${ansi(textOf(data))}</pre>`,
};

const OUTPUT: {
  [K in KnownOutput["output_type"]]: (output: Extract<KnownOutput, { output_type: K }>) => Promise<string>;
} = {
  stream: async ({ name, text }) =>
    `<div class="nb-out" data-kind="stream" data-name="${escape(name)}"><pre>${ansi(textOf(text))}</pre></div>`,
  error: async ({ traceback }) =>
    `<div class="nb-out" data-kind="error"><pre>${ansi(traceback.join("\n"))}</pre></div>`,
  display_data: async ({ data }) => bundleHtml(data),
  execute_result: async ({ data }) => bundleHtml(data),
};

async function bundleHtml(data: Record<string, unknown>): Promise<string> {
  const mime = MIMES.find((one) => one in data);
  return mime ? `<div class="nb-out" data-kind="data">${await RENDER[mime](data[mime])}</div>` : "";
}

async function outputHtml(output: NotebookOutput): Promise<string> {
  const known = NotebookFormat.known(output);
  if (!known) return "";
  const render = OUTPUT[known.output_type] as (output: KnownOutput) => Promise<string>;
  return render(known);
}

async function outputs(list: NotebookOutput[]): Promise<string> {
  return (await Promise.all(list.map(outputHtml))).join("");
}

function withAttachments(html: string, cell: NotebookCell): string {
  const held = NotebookFormat.isCode(cell) ? undefined : cell.attachments;
  if (!held) return html;
  return html.replace(/src="attachment:([^"]+)"/g, (whole, name: string) => {
    const bundle = held[decodeURIComponent(name)];
    const mime = bundle && Object.keys(bundle).find((one) => one.startsWith("image/"));
    return mime && bundle ? `src="data:${mime};base64,${base64Of(bundle[mime])}"` : whole;
  });
}

interface CellOptions {
  cell: NotebookCell;
  index: number;
  language: string;
  runnable: boolean;
}

async function cellHtml({ cell, index, language, runnable }: CellOptions): Promise<string> {
  const key = escape(NotebookFormat.keyOf(cell, index));
  const source = NotebookFormat.textOf(cell.source);
  if (cell.cell_type === "markdown")
    return `<div class="nb-cell" data-cell="${key}" data-kind="markdown">${withAttachments(await Markdown.body(source), cell)}</div>`;
  if (!NotebookFormat.isCode(cell))
    return `<div class="nb-cell nb-raw" data-cell="${key}" data-kind="raw"><pre>${escape(source)}</pre></div>`;
  const count = cell.execution_count ? `[${cell.execution_count}]` : "";
  const run = runnable
    ? `<button type="button" class="nb-run" data-run-cell="${key}" title="Run this cell" aria-label="Run this cell">${PLAY}${SPIN}</button>`
    : "";
  return [
    `<div class="nb-cell nb-code" data-cell="${key}" data-kind="code" data-state="idle">`,
    `<div class="nb-gutter">${run}<span class="nb-count">${count}</span></div>`,
    `<pre class="nb-source"><code>${await Syntax.code(source, language)}</code></pre>`,
    `<div class="nb-outputs">${await outputs(cell.outputs)}</div>`,
    "</div>",
  ].join("");
}

export interface NotebookPageOptions {
  ds?: string;
  notebook: Notebook;
  /** Off where nothing listens for a run, as in a preview inside Files. */
  runnable?: boolean;
  title: string;
}

async function page({ ds, notebook, runnable = true, title }: NotebookPageOptions): Promise<string> {
  const language = NotebookFormat.languageOf(notebook);
  const cells = await Promise.all(notebook.cells.map((cell, index) => cellHtml({ cell, index, language, runnable })));
  const body = cells.length ? cells.join("\n") : '<p class="nb-raw">This notebook has no cells yet.</p>';
  return Markdown.document({ body, css: CSS, ds, title });
}

export const NotebookPage = { outputs, page };
