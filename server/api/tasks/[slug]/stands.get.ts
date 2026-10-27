import { TaskRoute } from "~~/server/utils/tasks/route";
import { TaskStanding } from "~~/server/utils/tasks/stands";
import type { TaskStands } from "~~/shared/types/history";

export default defineEventHandler(async (event): Promise<{ stands?: TaskStands }> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  const stands = await TaskStanding.of({ slug: file.slug, title: file.title, state: file.task.state });
  return stands ? { stands } : {};
});
