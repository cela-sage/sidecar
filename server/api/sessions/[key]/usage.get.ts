import z from "zod";
import { isKey } from "~~/server/utils/sessions/paths";
import { UsageStore } from "~~/server/utils/sessions/usage";
import type { SessionUsage } from "~~/shared/types/usage";

const Query = z.object({ breakdown: z.literal("1").optional() });

export default defineEventHandler(async (event): Promise<{ usage?: SessionUsage }> => {
  const key = getRouterParam(event, "key") || "";
  const { breakdown } = await getValidatedQuery(event, (raw) => Query.parse(raw));
  if (!isKey(key)) return {};
  if (breakdown) UsageStore.askBreakdown(key);
  return { usage: UsageStore.held(key) };
});
