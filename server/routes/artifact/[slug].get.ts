import type { ArtifactFormat } from "../../../shared/types/artifact";
import { readArtifact, stripReviewLayer } from "../../utils/artifacts";
import { Markdown } from "../../utils/markdown";
import { Notebooks } from "../../utils/notebooks";
import { Versions } from "../../utils/sessions/versions";

interface Render {
  ds?: string;
  text: string;
  title: string;
}

const RENDER: Record<Exclude<ArtifactFormat, "media">, (input: Render) => Promise<string> | string> = {
  html: ({ text }) => stripReviewLayer(text),
  md: ({ ds, text, title }) => Markdown.page({ ds, markdown: text, title }),
  ipynb: ({ ds, text, title }) => {
    const notebook = Notebooks.parse(text);
    if (!notebook)
      throw createError({ statusCode: 422, statusMessage: `'${title}' is not a notebook the sidecar can read` });
    return Notebooks.render({ ds, notebook, title });
  },
};

// A stored version of a .md or a notebook is raw text, so the read view asks this route to render it rather than using srcdoc.
export default defineEventHandler(async (event): Promise<string> => {
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, statusMessage: "missing slug" });

  const source = await readArtifact(slug);
  if (!source || source.kind === "web" || source.format === "media")
    throw createError({ statusCode: 404, statusMessage: `no page matching '${slug}'` });

  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  // The file on disk is rewritten by every rebuild, so a cached frame would show a stale page.
  setResponseHeader(event, "cache-control", "no-store");
  const title = source.title || slug;
  const { session, turn } = getQuery(event);
  const at = Number(turn) || 0;
  if (source.format === "html" || typeof session !== "string" || !session || !at)
    return RENDER[source.format]({ ds: source.ds, text: source.text, title });
  const stored = await Versions.content({ key: session, path: source.path, turn: at });
  if (!stored.found) throw createError({ statusCode: 404, statusMessage: `no version t${at} of '${slug}'` });
  return RENDER[source.format]({ ds: source.ds, text: stored.content, title });
});
