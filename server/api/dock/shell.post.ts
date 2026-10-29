import { isAbsolute } from "node:path";
import z from "zod";
import { isOwnOrigin } from "~~/server/utils/dock/origin";
import { DockTabs } from "~~/server/utils/dock/tabs";
import type { DockTab } from "~~/shared/types/dock";

const Body = z.object({
  project: z.string().min(1),
  folder: z.string().refine(isAbsolute, "an absolute folder").optional(),
  cols: z.number().int().min(2).max(500),
  rows: z.number().int().min(2).max(300),
});

export default defineEventHandler(async (event): Promise<DockTab> => {
  if (!isOwnOrigin(getRequestHost(event), getRequestHeader(event, "origin")))
    throw createError({ statusCode: 403, statusMessage: "only the sidecar's own page can open a terminal" });
  const body = await readValidatedBody(event, (raw) => Body.parse(raw));
  return DockTabs.shell(body);
});
