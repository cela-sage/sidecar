import z from "zod";
import { deliver, type DeliverResult } from "~~/server/utils/sessions/inbox";
import { SlashCommand } from "~~/shared/utils/slash-command";

const Body = z.object({ name: z.string().refine(SlashCommand.isName), args: z.string() });

export default defineEventHandler(async (event): Promise<DeliverResult> => {
  const key = getRouterParam(event, "key") || "";
  const body = Body.safeParse(await readBody(event));
  if (!key || !body.success) return { delivered: false, reason: "refused-by-inbox" };
  return deliver({ key, text: JSON.stringify({ do: "command", ...body.data }) });
});
