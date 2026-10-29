import z from "zod";
import { isOwnOrigin } from "~~/server/utils/dock/origin";
import { DockTabs } from "~~/server/utils/dock/tabs";
import { Projects } from "~~/server/utils/projects";
import { RunConfigs } from "~~/server/utils/runs/configs";
import type { DockTab } from "~~/shared/types/dock";

const Body = z.object({
  config: z.string().min(1),
  cols: z.number().int().min(2).max(500),
  rows: z.number().int().min(2).max(300),
});

export default defineEventHandler(async (event): Promise<DockTab> => {
  if (!isOwnOrigin(getRequestHost(event), getRequestHeader(event, "origin")))
    throw createError({ statusCode: 403, statusMessage: "only the sidecar's own page can start a run" });
  const body = await readValidatedBody(event, (raw) => Body.parse(raw));
  const project = Projects.find(getRouterParam(event, "project"));
  const config = project && RunConfigs.find(project, body.config);
  if (!project || !config) throw createError({ statusCode: 404, statusMessage: "no such run configuration" });
  return DockTabs.run({ project: project.key, config, cols: body.cols, rows: body.rows });
});
