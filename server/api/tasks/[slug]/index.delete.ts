import * as Events from "~~/lib/sidecar/events";
import { Desk } from "~~/server/utils/desk";
import { TaskLane } from "~~/server/utils/tasks/lane";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { TaskRemoved } from "~~/shared/types/desk";

export default defineEventHandler(async (event): Promise<TaskRemoved> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  Desk.cancelHandoff(file.slug);
  const { stopped } = await TaskLane.remove({ given: file.slug, caller: { who: "YOU" } }).catch(TaskRoute.refused);
  Events.publish({ topic: "task.changed", data: { slug: file.slug, state: file.task.state } });
  return { trashed: true, stopped };
});
