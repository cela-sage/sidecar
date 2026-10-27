import z from "zod";
import { MarkdownSource } from "~~/server/utils/edits/source";
import type { FileSave } from "~~/shared/types/files";

const Body = z.object({ base: z.string().min(1), text: z.string() });

export default defineEventHandler(async (event): Promise<FileSave> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const body = await readValidatedBody(event, (raw) => Body.parse(raw));
  const { path } = await MarkdownSource.markdown(slug);
  return MarkdownSource.save({ ...body, path });
});
