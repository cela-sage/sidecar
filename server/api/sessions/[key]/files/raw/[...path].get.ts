import { resolve } from "node:path";
import { isFile } from "~~/lib/files";
import { Media } from "~~/server/utils/media";
import { originalOf } from "~~/server/utils/review/ledger";
import { isReachable } from "~~/server/utils/sessions/files";
import { SentImages } from "~~/server/utils/sessions/sent-images";

const notHere = () => createError({ statusCode: 404, statusMessage: "not here" });

// The path rides in the URL rather than the query, so a page's relative assets resolve to their own files here.
export default defineEventHandler((event): Promise<unknown> | Buffer => {
  const key = getRouterParam(event, "key") || "";
  const path = resolve("/", getRouterParam(event, "path", { decode: true }) ?? "");
  const isReached = originalOf({ key, path }).kind !== "untracked" || isReachable({ key, path });
  const isOnDisk = isFile(path);
  const pasted = isReached && isOnDisk ? undefined : SentImages.find({ key, path });
  if (isOnDisk && (isReached || pasted)) {
    return Media.send(event, { asPage: getQuery(event).as === "page", file: path, name: path });
  }
  if (!pasted?.bytes) throw notHere();
  setResponseHeaders(event, { "cache-control": "no-store", "content-type": pasted.type ?? "application/octet-stream" });
  return pasted.bytes;
});
