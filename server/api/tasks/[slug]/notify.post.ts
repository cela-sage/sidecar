import z from "zod";
import { TaskNotice } from "~~/server/utils/tasks/notice";
import { TaskRoute } from "~~/server/utils/tasks/route";

const Body = z.object({ subtitle: z.string().max(80), text: z.string().min(1).max(400) });

export default defineEventHandler(async (event): Promise<{ raised: true }> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  const { subtitle, text } = await readValidatedBody(event, (raw) => Body.parse(raw));
  TaskNotice.mac({ title: file.title, subtitle, text });
  return { raised: true };
});
