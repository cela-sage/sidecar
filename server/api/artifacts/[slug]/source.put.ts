import z from "zod";
import { MarkdownSource } from "~~/server/utils/edits/source";
import { TaskLane } from "~~/server/utils/tasks/lane";
import type { FileSave } from "~~/shared/types/files";

const Body = z.object({ base: z.string().min(1), text: z.string() });

export default defineEventHandler(async (event): Promise<FileSave> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const body = await readValidatedBody(event, (raw) => Body.parse(raw));
  const source = await MarkdownSource.markdown(slug);
  const saved = await MarkdownSource.save({ ...body, path: source.path });
  if (saved.saved && source.task) {
    const file = { path: source.path, slug: source.slug, title: source.title, task: source.task };
    TaskLane.edited({ file, before: source.text, after: body.text });
  }
  return saved;
});
