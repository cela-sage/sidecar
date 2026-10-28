import z from "zod";
import { Desk } from "~~/server/utils/desk";
import { isKey } from "~~/server/utils/sessions/paths";

const Query = z.object({ key: z.string().toLowerCase().refine(isKey, "a session's 8-hex key") });

export default defineEventHandler(async (event): Promise<{ cancelled: true }> => {
  const { key } = await getValidatedQuery(event, (raw) => Query.parse(raw));
  Desk.cancelLead(getRouterParam(event, "slug") ?? "", key);
  return { cancelled: true };
});
