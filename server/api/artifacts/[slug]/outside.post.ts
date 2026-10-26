import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readArtifact } from "~~/server/utils/artifacts";

const run = promisify(execFile);

// Chrome refuses a file:// link from the sidecar's own page, so the server hands the file to macOS instead.
export default defineEventHandler(async (event): Promise<void> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const source = await readArtifact(slug);
  if (!source || source.kind === "web")
    throw createError({ statusCode: 404, statusMessage: `no file matching '${slug}'` });
  await run("open", [source.path]).catch((error: unknown) => {
    console.error(`[artifacts] could not open ${source.path} outside`, error);
    throw createError({ statusCode: 500, statusMessage: "the file could not be opened outside the sidecar" });
  });
});
