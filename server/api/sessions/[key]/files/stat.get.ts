import { statSync } from "node:fs";
import type { FileStat } from "~~/shared/types/files";
import { isReachable } from "~~/server/utils/sessions/files";

// Always a 200, so a chat naming a file that is not there draws nothing and logs no failed request.
export default defineEventHandler((event): FileStat => {
  const key = getRouterParam(event, "key") || "";
  const path = String(getQuery(event).path ?? "");
  const found = isReachable({ key, path }) ? statSync(path, { throwIfNoEntry: false }) : undefined;
  return found?.isFile() ? { path, size: found.size } : { path };
});
