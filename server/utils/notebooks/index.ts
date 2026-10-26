import type { H3Event } from "h3";
import { readArtifact } from "../artifacts.ts";
import { NotebookFormat } from "./format.ts";
import { NotebookPage } from "./page.ts";
import { NotebookRuns } from "./runs.ts";

async function pathOf(event: H3Event): Promise<string> {
  const slug = getRouterParam(event, "slug") ?? "";
  const source = await readArtifact(slug);
  if (source?.format !== "ipynb")
    throw createError({ statusCode: 404, statusMessage: `no notebook matching '${slug}'` });
  return source.path;
}

export const Notebooks = {
  parse: NotebookFormat.parse,
  pathOf,
  render: NotebookPage.page,
  runs: NotebookRuns,
};
