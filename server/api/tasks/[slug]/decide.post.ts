import z from "zod";
import { TaskLane } from "~~/server/utils/tasks/lane";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { TaskDecided } from "~~/shared/types/history";

const Body = z
  .object({ thread: z.string().min(1), option: z.number().int().positive().optional(), text: z.string().optional() })
  .refine((body) => !!body.option || !!body.text?.trim(), "an option or your own words");

export default defineEventHandler(async (event): Promise<TaskDecided> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  const { option, text = "", thread } = await readValidatedBody(event, (raw) => Body.parse(raw));
  const answer = option ? String(option) : text;
  const decided = await Promise.resolve()
    .then(() => TaskLane.decide({ given: file.slug, caller: { who: "YOU" }, answer, thread }))
    .catch(TaskRoute.refused);
  return { text: decided.text, state: decided.file.task.state, told: await TaskLane.tell(decided) };
});
