import { stat } from "node:fs/promises";
import { Media } from "~~/server/utils/media";
import { Uploads } from "~~/server/utils/uploads";

export default defineEventHandler(async (event): Promise<unknown> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const name = getRouterParam(event, "name") ?? "";
  const file = Uploads.pathOf({ name, slug });
  const stats = file ? await stat(file).catch(() => undefined) : undefined;
  if (!file || !stats?.isFile()) throw createError({ statusCode: 404, statusMessage: `no upload '${slug}/${name}'` });
  return Media.send(event, { file, name });
});
