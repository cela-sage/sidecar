import { TaskHistory } from "~~/server/utils/tasks/history";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { HistoryEntry } from "~~/shared/types/history";

export default defineEventHandler(async (event): Promise<{ entries: HistoryEntry[] }> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  return { entries: TaskHistory.read(file.slug) };
});
