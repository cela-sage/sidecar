import z from "zod";
import { summaryOf } from "~~/server/utils/sessions/summary";

const Query = z.object({ at: z.coerce.number().int().positive() });

export default defineEventHandler(async (event): Promise<{ text: string }> => {
  const key = getRouterParam(event, "key") || "";
  const { at } = await getValidatedQuery(event, (raw) => Query.parse(raw));
  const text = await summaryOf({ key, at });
  if (!text) throw createError({ statusCode: 404, statusMessage: "no summary" });
  return { text };
});
