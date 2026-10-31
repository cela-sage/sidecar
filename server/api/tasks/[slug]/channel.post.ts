import z from "zod";
import { Channels } from "~~/server/utils/channels";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { ChannelPost } from "~~/shared/types/channel";

const Body = z.object({
  text: z.string().trim().min(1),
  thread: z.string().min(1).optional(),
  broadcast: z.boolean().optional(),
});

export default defineEventHandler(async (event): Promise<ChannelPost> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  const { text, thread, broadcast } = await readValidatedBody(event, (raw) => Body.parse(raw));
  const author = { by: "YOU", who: "YOU" } as const;
  return await Channels.post({
    given: file.slug,
    author,
    text,
    ...(thread ? { thread } : {}),
    ...(broadcast ? { broadcast } : {}),
  }).catch(TaskRoute.refused);
});
