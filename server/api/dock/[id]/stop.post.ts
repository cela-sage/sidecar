import { isOwnOrigin } from "~~/server/utils/dock/origin";
import { DockTabs } from "~~/server/utils/dock/tabs";

export default defineEventHandler(async (event): Promise<{ stopped: true }> => {
  if (!isOwnOrigin(getRequestHost(event), getRequestHeader(event, "origin")))
    throw createError({ statusCode: 403, statusMessage: "only the sidecar's own page can stop a run" });
  if (!(await DockTabs.stop(getRouterParam(event, "id") ?? "")))
    throw createError({ statusCode: 404, statusMessage: "no such run" });
  return { stopped: true };
});
