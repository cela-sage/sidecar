import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Sidecar } from "../../../lib/sidecar/paths.ts";

// The house style every page artifact starts from, so a .md reads as one of them and follows its data-ds.
const STYLESHEETS = ["themes.css", "doc-system.css"];
const MARKDOWN_CSS = `blockquote{border-left:2px solid var(--border-strong);color:var(--muted);margin:0;padding-left:14px}
img{max-width:100%}
li>p{margin:0}
.contains-task-list{list-style:none;padding-left:0}
.task-list-item-checkbox{accent-color:var(--accent);margin-right:6px}`;
// A wide diagram scrolls once fitting it would shrink its labels below three quarters of their size.
const DIAGRAM_CSS = `.diagram{--page-bg:var(--bg);overflow-x:auto}
.diagram svg{display:block;height:auto;margin-inline:auto;width:clamp(calc(var(--natural)*.75),100%,var(--natural))}
.diagram text{font-family:var(--sans)}
.diagram .mono{font-family:var(--mono)}`;
// The frame injects del[data-sc-edit] and ins[data-sc-edit] in red and green, so these selectors carry the page class to outrank them.
const PROPOSAL_CSS = `.page del[data-sc-edit]{color:var(--muted);display:block;font-size:12.5px;line-height:1.55;text-decoration:line-through}
.page ins[data-sc-edit]{background:var(--accent-soft);border-radius:4px;color:var(--ink);display:block;margin:0 -4px;padding:2px 4px;text-decoration:none}`;
const FIGURE_CSS = `figure.pasted{border:1px solid var(--border);border-radius:12px;margin:0;overflow:hidden}
figure.pasted img{display:block;height:auto;width:100%}
figure.pasted figcaption{align-items:center;border-top:1px solid var(--border);color:var(--muted);display:flex;font-size:12px;gap:10px;padding:8px 10px 8px 12px}
figure.pasted figcaption>span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
figure.pasted .name{font-family:var(--mono);font-size:10px}
figure.pasted .preview{border:1px solid var(--border);border-radius:999px;color:var(--muted);font-size:11px;padding:1px 8px;text-decoration:none}
figure.pasted .preview:hover{border-color:var(--accent);color:var(--accent)}`;
const TASK_CSS = `body:has(>.page[data-task]){background:transparent}
.page[data-task]{padding-top:24px}
.page[data-task]>:first-child>h2:first-child{margin-top:0}
.page[data-task] h2[data-needs-data]::after{align-items:center;border:1px dashed var(--border-strong);border-radius:999px;color:var(--muted);content:attr(data-needs-data);display:inline-flex;font-family:var(--mono);font-size:10px;font-weight:500;height:18px;letter-spacing:0;margin-left:10px;padding:0 8px;vertical-align:middle}
.impact{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));list-style:none;margin:0;padding:0}
.impact li{margin:0}
.impact .card{background:var(--surface-2);border:1px solid transparent;border-radius:12px;color:var(--muted);font-size:12px;line-height:1.5;padding:12px 14px}
.impact .card>strong{color:var(--ink);display:block;font-size:24px;font-weight:800;line-height:1.2}
.impact .card[data-waiting]{background:none;border-color:var(--border-strong);border-style:dashed}
.impact .card[data-waiting]>strong{color:var(--muted)}`;

let houseCss: string | undefined;

const readStyle = (name: string): string => {
  try {
    return readFileSync(join(Sidecar.root(), "lib", "sidecar", "assets", name), "utf8");
  } catch {
    return ""; // an unstyled page still reads, which beats failing the route over a stylesheet
  }
};

export const pageCss = (): string => {
  houseCss ??= STYLESHEETS.map(readStyle).join("\n");
  return [houseCss, MARKDOWN_CSS, DIAGRAM_CSS, PROPOSAL_CSS, FIGURE_CSS, TASK_CSS].join("\n");
};
