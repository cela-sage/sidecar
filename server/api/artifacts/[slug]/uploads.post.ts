import { readArtifact } from "~~/server/utils/artifacts";
import { Uploads } from "~~/server/utils/uploads";
import type { ArtifactUpload } from "~~/shared/types/artifact";

const tooLarge = () => createError({ statusCode: 413, statusMessage: "The image is over 20 MB" });

export default defineEventHandler(async (event): Promise<ArtifactUpload> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const extension = Uploads.extensionOf(getRequestHeader(event, "content-type"));
  if (!extension)
    throw createError({ statusCode: 415, statusMessage: "Only png, jpeg, gif and webp images can be pasted" });
  if (Number(getRequestHeader(event, "content-length")) > Uploads.maxBytes) throw tooLarge();

  const source = Uploads.isSafe(slug) ? await readArtifact(slug) : undefined;
  if (source?.kind !== "page") throw createError({ statusCode: 404, statusMessage: `no artifact matching '${slug}'` });

  const bytes = await readRawBody(event, false);
  if (!bytes?.length) throw createError({ statusCode: 400, statusMessage: "The image is empty" });
  if (bytes.length > Uploads.maxBytes) throw tooLarge();
  return Uploads.save({ bytes, extension, slug });
});
