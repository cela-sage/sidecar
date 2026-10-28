import z from "zod";
import { OpenQuestions } from "~~/server/utils/sessions/questions";
import { Questions } from "~~/shared/utils/question";

const Body = z.object({ key: z.string().regex(/^[0-9a-f]{8}$/), questions: z.array(z.unknown()) });

export default defineEventHandler(async (event): Promise<{ asked: boolean }> => {
  const ref = getRouterParam(event, "ref") || "";
  const body = Body.safeParse(await readBody(event));
  const questions = body.success ? Questions.of(body.data.questions) : undefined;
  if (!ref || !body.success || !questions) return { asked: false };
  OpenQuestions.ask({ key: body.data.key, ref, questions });
  return { asked: true };
});
