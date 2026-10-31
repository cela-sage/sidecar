import { Channels } from "~~/server/utils/channels";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { Channel } from "~~/shared/types/channel";

export default defineEventHandler(async (event): Promise<Channel> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  return await Promise.resolve()
    .then(() => Channels.read(file.slug))
    .catch(TaskRoute.refused);
});
