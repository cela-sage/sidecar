import { Uploads } from "~~/server/utils/uploads";
import type { AttachedFile } from "~~/shared/types/files";

const tooLarge = () => createError({ statusCode: 413, statusMessage: "The file is over 20 MB" });

export default defineEventHandler(async (event): Promise<AttachedFile> => {
  if (Number(getRequestHeader(event, "content-length")) > Uploads.maxBytes) throw tooLarge();
  const bytes = await readRawBody(event, false);
  if (!bytes?.length) throw createError({ statusCode: 400, statusMessage: "The file is empty" });
  if (bytes.length > Uploads.maxBytes) throw tooLarge();
  return Uploads.attach({ bytes, name: String(getQuery(event).name ?? "") });
});
