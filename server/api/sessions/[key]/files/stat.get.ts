import { statSync } from "node:fs";
import type { FileStat } from "~~/shared/types/files";
import { isReadable } from "~~/server/utils/sessions/files";
import { SentImages } from "~~/server/utils/sessions/sent-images";

// Always a 200, so a chat naming a file that is not there draws nothing and logs no failed request.
export default defineEventHandler((event): FileStat => {
  const key = getRouterParam(event, "key") || "";
  const path = String(getQuery(event).path ?? "");
  const isReached = isReadable({ key, path });
  const found = statSync(path, { throwIfNoEntry: false });
  const pasted = isReached && found?.isFile() ? undefined : SentImages.find({ key, path });
  if (found?.isFile() && (isReached || pasted)) return { path, size: found.size };
  return pasted?.bytes ? { path, size: pasted.bytes.length } : { path };
});
