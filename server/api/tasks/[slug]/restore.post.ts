import * as Events from "~~/lib/sidecar/events";
import { TaskTrash } from "~~/server/utils/tasks/trash";

export default defineEventHandler((event): { restored: true } => {
  const slug = getRouterParam(event, "slug") ?? "";
  if (!TaskTrash.restore(slug))
    throw createError({ statusCode: 404, statusMessage: `nothing to restore for '${slug}'` });
  Events.publish({ topic: "task.changed", data: { slug, state: "unassigned" } });
  return { restored: true };
});
