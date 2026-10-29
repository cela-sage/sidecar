import { Projects } from "~~/server/utils/projects";
import { RunConfigs } from "~~/server/utils/runs/configs";
import type { RunGroup } from "~~/shared/types/runs";

export default defineEventHandler((event): RunGroup[] => {
  const project = Projects.find(getRouterParam(event, "project"));
  if (!project) throw createError({ statusCode: 404, statusMessage: "no such project" });
  return RunConfigs.groupsOf(project);
});
