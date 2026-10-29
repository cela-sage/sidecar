import { isAbsolute } from "node:path";
import z from "zod";
import { isOwnOrigin } from "~~/server/utils/dock/origin";
import { DockTabs } from "~~/server/utils/dock/tabs";
import { Projects } from "~~/server/utils/projects";
import { RunConfigs } from "~~/server/utils/runs/configs";
import type { DockTab } from "~~/shared/types/dock";

const Size = { cols: z.number().int().min(2).max(500), rows: z.number().int().min(2).max(300) };
const Body = z.union([
  z.object({ config: z.string().min(1), ...Size }),
  z.object({
    command: z.string().min(1),
    folder: z.string().refine(isAbsolute, "an absolute folder").optional(),
    ...Size,
  }),
]);

export default defineEventHandler(async (event): Promise<DockTab> => {
  if (!isOwnOrigin(getRequestHost(event), getRequestHeader(event, "origin")))
    throw createError({ statusCode: 403, statusMessage: "only the sidecar's own page can start a run" });
  const body = await readValidatedBody(event, (raw) => Body.parse(raw));
  const key = getRouterParam(event, "project") ?? "";
  const { cols, rows } = body;
  if ("command" in body) return DockTabs.run({ project: key, config: RunConfigs.adhoc(body), cols, rows });
  const project = Projects.find(key);
  const config = project && RunConfigs.find(project, body.config);
  if (!project || !config) throw createError({ statusCode: 404, statusMessage: "no such run configuration" });
  return DockTabs.run({ project: project.key, config, cols, rows });
});
