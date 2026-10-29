import { isKey } from "~~/server/utils/sessions/paths";
import { UsageStore } from "~~/server/utils/sessions/usage";

export default defineEventHandler(async (event): Promise<{ heard: boolean }> => {
  const key = getRouterParam(event, "key") || "";
  const usage = UsageStore.Post.safeParse(await readBody(event));
  if (!isKey(key) || !usage.success) return { heard: false };
  UsageStore.answer(key, usage.data);
  return { heard: true };
});
