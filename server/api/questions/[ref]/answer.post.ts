import z from "zod";
import { OpenQuestions } from "~~/server/utils/sessions/questions";

const Body = z.object({ answers: z.record(z.string().min(1), z.string().min(1)) });

export default defineEventHandler(async (event): Promise<{ taken: boolean }> => {
  const ref = getRouterParam(event, "ref") || "";
  const body = Body.safeParse(await readBody(event));
  if (!ref || !body.success) return { taken: false };
  return { taken: await OpenQuestions.give(ref, body.data.answers) };
});
