import z from "zod";
import { isOwnOrigin } from "~~/server/utils/dock/origin";
import { DockTabs } from "~~/server/utils/dock/tabs";
import { isKey } from "~~/server/utils/sessions/paths";
import { Terminal } from "~~/server/utils/terminal";
import type { DockTab } from "~~/shared/types/dock";

const Body = z.object({
  project: z.string().min(1),
  key: z.string().toLowerCase().refine(isKey, "a session's 8-hex key"),
  cols: z.number().int().min(2).max(500),
  rows: z.number().int().min(2).max(300),
});

export default defineEventHandler(async (event): Promise<DockTab> => {
  if (!isOwnOrigin(getRequestHost(event), getRequestHeader(event, "origin")))
    throw createError({ statusCode: 403, statusMessage: "only the sidecar's own page can attach" });
  const body = await readValidatedBody(event, (raw) => Body.parse(raw));
  Terminal.release(body.key);
  return DockTabs.session(body);
});
