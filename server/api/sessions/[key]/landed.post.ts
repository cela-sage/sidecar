import z from "zod";
import * as Events from "~~/lib/sidecar/events.ts";

const Key = z.string().regex(/^[0-9a-f]{8}$/);
const Body = z.object({ text: z.string().min(1) });

export default defineEventHandler(async (event): Promise<{ landed: boolean }> => {
  const key = Key.safeParse(getRouterParam(event, "key"));
  const body = Body.safeParse(await readBody(event));
  if (!key.success || !body.success) return { landed: false };
  Events.publish({ topic: "message.landed", key: key.data, data: { key: key.data, text: body.data.text } });
  return { landed: true };
});
