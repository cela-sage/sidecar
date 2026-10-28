import * as Events from "~~/lib/sidecar/events";
import { TaskShelf } from "~~/server/utils/tasks/shelf";
import { TaskRoute } from "~~/server/utils/tasks/route";

export default defineEventHandler(async (event): Promise<{ hidden: true }> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  if (file.task.state !== "done")
    throw createError({ statusCode: 409, statusMessage: "refused", message: `${file.slug} is not done, so it stays` });
  TaskShelf.hide(file.slug);
  Events.publish({ topic: "task.changed", data: { slug: file.slug, state: file.task.state } });
  return { hidden: true };
});
