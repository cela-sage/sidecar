import z from "zod";
import { deliver, type DeliverResult } from "~~/server/utils/sessions/inbox";
import { TaskCaller } from "~~/server/utils/tasks/caller";
import { TaskLane } from "~~/server/utils/tasks/lane";

const Body = z.object({ text: z.string().min(1), slug: z.string().min(1).optional() });

export default defineEventHandler(async (event): Promise<DeliverResult> => {
  const key = getRouterParam(event, "key") || "";
  const body = Body.safeParse(await readBody(event));
  if (!key || !body.success) return { delivered: false, reason: "refused-by-inbox" };
  const sent = await deliver({ key, ...body.data });
  const from = TaskCaller.titleByKey(key);
  if (sent.delivered && from) TaskLane.heard({ caller: { who: "YOU", from }, kind: "message", ...body.data });
  return sent;
});
