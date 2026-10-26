import { readArtifact } from "~~/server/utils/artifacts";
import { Media } from "~~/server/utils/media";

export default defineEventHandler(async (event): Promise<unknown> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const source = await readArtifact(slug);
  if (!source || source.kind === "web")
    throw createError({ statusCode: 404, statusMessage: `no file matching '${slug}'` });
  return Media.send(event, { file: source.path, name: source.path });
});
