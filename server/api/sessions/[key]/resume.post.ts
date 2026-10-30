import { Lifecycle } from "~~/server/utils/sessions/lifecycle";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { LifeChange } from "~~/shared/types/session";

export default defineEventHandler((event): Promise<LifeChange> => {
  const key = getRouterParam(event, "key") || "";
  return Lifecycle.resume(key).catch(TaskRoute.refused);
});
