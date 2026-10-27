import { MarkdownSource } from "~~/server/utils/edits/source";
import { readDisk } from "~~/server/utils/sessions/files";
import type { FileContent } from "~~/shared/types/files";

export default defineEventHandler(async (event): Promise<FileContent> => {
  const { path } = await MarkdownSource.markdown(getRouterParam(event, "slug") ?? "");
  return readDisk(path);
});
