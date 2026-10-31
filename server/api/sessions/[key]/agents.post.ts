import { Agents } from "~~/server/utils/sessions/agents";
import { isKey } from "~~/server/utils/sessions/paths";

export default defineEventHandler(async (event): Promise<{ heard: boolean }> => {
  const key = getRouterParam(event, "key") || "";
  const change = Agents.Change.safeParse(await readBody(event));
  if (!isKey(key) || !change.success) return { heard: false };
  Agents.hear(key, change.data);
  return { heard: true };
});
