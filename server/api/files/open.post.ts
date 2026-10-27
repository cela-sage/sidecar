import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { expandHome } from "~~/lib/sidecar/paths";
import { Tracked } from "~~/lib/sidecar/tracked";
import { isKey } from "~~/server/utils/sessions/paths";
import type { FileOpenReply } from "~~/shared/types/files";

function fieldOf(raw: unknown, name: string): string {
  const value = typeof raw === "object" && raw ? (raw as Record<string, unknown>)[name] : "";
  return typeof value === "string" ? value.trim() : "";
}

export default defineEventHandler(async (event): Promise<FileOpenReply> => {
  const raw: unknown = await readBody(event);
  const given = fieldOf(raw, "path");
  if (!given) throw createError({ statusCode: 400, statusMessage: "a path is needed" });
  const base = fieldOf(raw, "base");
  const full = resolve(base ? expandHome(base) : homedir(), expandHome(given));
  if (!statSync(full, { throwIfNoEntry: false })?.isFile())
    throw createError({ statusCode: 404, statusMessage: `no file at ${full}` });
  const real = realpathSync(full);
  if (!Tracked.isTrackable(real)) return { at: "files", path: real };
  const session = fieldOf(raw, "session").toLowerCase();
  return { at: "artifacts", slug: Tracked.enter(real, isKey(session) ? session : undefined) };
});
