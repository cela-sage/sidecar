import z from "zod";
import { describeDraft } from "~~/server/utils/artifacts";
import { MarkdownSource } from "~~/server/utils/edits/source";
import { Markdown } from "~~/server/utils/markdown";

const Body = z.object({ text: z.string() });

export default defineEventHandler(async (event): Promise<string> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const { text } = await readValidatedBody(event, (raw) => Body.parse(raw));
  const source = await MarkdownSource.markdown(slug);
  const draft = describeDraft({ path: source.path, slug, text });
  setResponseHeaders(event, { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" });
  return Markdown.page({
    ds: draft.ds ?? source.ds,
    markdown: text,
    task: draft.task,
    title: draft.title || slug,
  });
});
