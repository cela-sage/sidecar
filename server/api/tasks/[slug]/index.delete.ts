import * as Events from "~~/lib/sidecar/events";
import { Desk } from "~~/server/utils/desk";
import { TaskRoute } from "~~/server/utils/tasks/route";
import { TaskTrash } from "~~/server/utils/tasks/trash";
import type { TaskState } from "~~/shared/types/task";

const BACKLOG: TaskState[] = ["unassigned", "assigned", "assessed"];

export default defineEventHandler(async (event): Promise<{ trashed: true }> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  if (!BACKLOG.includes(file.task.state))
    throw createError({
      statusCode: 409,
      statusMessage: "refused",
      message: `${file.slug} is past the backlog, so it stays`,
    });
  Desk.cancelHandoff(file.slug);
  if (!TaskTrash.trash(file))
    throw createError({
      statusCode: 409,
      statusMessage: "refused",
      message: `${file.slug} lives outside the artifacts`,
    });
  Events.publish({ topic: "task.changed", data: { slug: file.slug, state: file.task.state } });
  return { trashed: true };
});
