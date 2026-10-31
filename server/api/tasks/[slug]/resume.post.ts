import z from "zod";
import { Channels } from "~~/server/utils/channels";
import { isKey } from "~~/server/utils/sessions/paths";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { Resumed } from "~~/shared/types/channel";

const Body = z.object({ keys: z.array(z.string().toLowerCase().refine(isKey, "a session's 8-hex key")).min(1) });

export default defineEventHandler(async (event): Promise<Resumed> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  const { keys } = await readValidatedBody(event, (raw) => Body.parse(raw));
  return await Channels.resume({ given: file.slug, by: "YOU", keys }).catch(TaskRoute.refused);
});
