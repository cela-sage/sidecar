import { stat } from "node:fs/promises";
import { Media } from "~~/server/utils/media";
import { Projects } from "~~/server/utils/projects";

export default defineEventHandler(async (event): Promise<unknown> => {
  const key = getRouterParam(event, "key") ?? "";
  const file = Projects.list().find((one) => one.key === key)?.image;
  const stats = file ? await stat(file).catch(() => undefined) : undefined;
  if (!file || !stats?.isFile()) throw createError({ statusCode: 404, statusMessage: `no image for project '${key}'` });
  return Media.send(event, { file, name: file });
});
