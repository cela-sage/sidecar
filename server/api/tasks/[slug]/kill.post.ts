import { Channels } from "~~/server/utils/channels";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { Killed } from "~~/shared/types/channel";

export default defineEventHandler(async (event): Promise<Killed> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  return await Channels.kill({ given: file.slug, by: "YOU" }).catch(TaskRoute.refused);
});
