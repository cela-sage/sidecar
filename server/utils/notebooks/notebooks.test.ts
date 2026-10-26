import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { NotebookEvent } from "../../../shared/types/notebook.ts";
import { NotebookFormat } from "./format.ts";
import { NotebookPage } from "./page.ts";
import { NotebookRuns } from "./runs.ts";

const code = (id: string, source: string | string[]): Record<string, unknown> => ({
  cell_type: "code",
  execution_count: null,
  id,
  metadata: {},
  outputs: [],
  source,
});

const notebookOf = (cells: Record<string, unknown>[]): string =>
  JSON.stringify({
    cells,
    metadata: { kernelspec: { display_name: "Python 3", language: "python", name: "python3" } },
    nbformat: 4,
    nbformat_minor: 5,
  });

const hasJupyter =
  spawnSync(process.env.SIDECAR_PYTHON || "python3", ["-c", "import jupyter_server, ipykernel"]).status === 0;

test("a notebook draws its prose, its code and Jupyter's outputs, with run buttons only where a run is heard", async () => {
  const notebook = NotebookFormat.parse(
    notebookOf([
      { cell_type: "markdown", id: "intro", metadata: {}, source: ["# Sales\n", "By region."] },
      {
        ...code("table", "df"),
        execution_count: 3,
        outputs: [
          {
            data: { "text/html": ["<table><tr><td>EU</td></tr></table>"], "text/plain": ["  EU"] },
            execution_count: 3,
            metadata: {},
            output_type: "execute_result",
          },
          { ename: "KeyError", evalue: "'x'", output_type: "error", traceback: ["\u001b[0;31mKeyError\u001b[0m: 'x'"] },
          { output_type: "something_new" },
        ],
      },
    ]),
  );
  if (!notebook) assert.fail("the notebook did not parse");
  assert.equal(NotebookFormat.titleOf(notebook), "Sales");

  const page = await NotebookPage.page({ notebook, title: "Sales" });
  assert.match(page, /<h1[^>]*>Sales<\/h1>/);
  assert.match(page, /data-cell="table"[^>]*data-kind="code"/);
  assert.match(page, /\[3\]/);
  assert.match(page, /<table><tr><td>EU<\/td><\/tr><\/table>/);
  assert.doesNotMatch(page, /  EU/);
  assert.match(page, /<span class="ansi-red-fg">KeyError<\/span>: &#x27;x&#x27;/);
  assert.match(page, /data-run-cell="table"/);

  const preview = await NotebookPage.page({ notebook, runnable: false, title: "Sales" });
  assert.doesNotMatch(preview, /data-run-cell/);
});

test(
  "a run executes the code cells in the notebook's folder, saves each one's outputs back and stops the queue at a failure",
  { skip: !hasJupyter && "needs jupyter_server and ipykernel in python3", timeout: 90_000 },
  async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "notebook-")));
    const path = join(dir, "run.ipynb");
    writeFileSync(join(dir, "data.txt"), "42\n");
    writeFileSync(
      path,
      notebookOf([
        { cell_type: "markdown", id: "intro", metadata: {}, source: "# Run" },
        code("read", ["n = int(open('data.txt').read())\n", "print(n)"]),
        code("show", "n * 2"),
        code("fail", "1/0"),
        code("after", "print('never')"),
      ]),
    );
    const seen: NotebookEvent[] = [];
    const settled = new Promise<void>((done) => {
      const off = NotebookRuns.on(path, (event) => {
        seen.push(event);
        if (event.type === "cell" && event.cell === "after" && event.run === "cancelled") {
          off();
          done();
        }
      });
    });
    try {
      await NotebookRuns.run(path);
      await settled;
      const runs = seen.flatMap((event) =>
        event.type === "cell" && event.run !== "running" ? [`${event.cell} ${event.run}`] : [],
      );
      assert.deepEqual(runs, [
        "read queued",
        "show queued",
        "fail queued",
        "after queued",
        "read done",
        "show done",
        "fail failed",
        "after cancelled",
      ]);

      const saved = NotebookFormat.parse(readFileSync(path, "utf8"));
      const cells = new Map(saved?.cells.filter(NotebookFormat.isCode).map((cell) => [cell.id, cell]));
      assert.deepEqual(cells.get("read")?.outputs, [{ name: "stdout", output_type: "stream", text: ["42\n"] }]);
      assert.equal(cells.get("show")?.execution_count, 2);
      const shown = cells.get("show")?.outputs[0];
      assert.deepEqual(shown && "data" in shown ? shown.data : undefined, { "text/plain": ["84"] });
      assert.equal(cells.get("fail")?.outputs[0]?.output_type, "error");
      assert.deepEqual(cells.get("after")?.outputs, []);
      assert.ok(readFileSync(path, "utf8").startsWith('{\n "cells": [\n'), "saved with Jupyter's own indent");
    } finally {
      await NotebookRuns.stopAll();
      rmSync(dir, { force: true, recursive: true });
    }
  },
);
