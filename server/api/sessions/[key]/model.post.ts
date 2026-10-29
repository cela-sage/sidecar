import z from "zod";
import { deliver, type DeliverResult } from "~~/server/utils/sessions/inbox";

const Body = z.object({ model: z.string().regex(/^claude-[a-z0-9-]{2,60}$/) });

export default defineEventHandler(async (event): Promise<DeliverResult> => {
  const key = getRouterParam(event, "key") || "";
  const body = Body.safeParse(await readBody(event));
  if (!key || !body.success) return { delivered: false, reason: "refused-by-inbox" };
  return deliver({ key, text: JSON.stringify({ do: "model", model: body.data.model }) });
});
