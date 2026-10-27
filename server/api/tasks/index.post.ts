import z from "zod";
import { TaskLane } from "~~/server/utils/tasks/lane";

const Body = z.object({ title: z.string().trim().min(1).max(160) });

export default defineEventHandler(async (event): Promise<{ slug: string }> => {
  const { title } = await readValidatedBody(event, (raw) => Body.parse(raw));
  return { slug: TaskLane.create(title).slug };
});
