import { OpenQuestions, type QuestionAnswers } from "~~/server/utils/sessions/questions";

export default defineEventHandler(async (event): Promise<QuestionAnswers | ""> => {
  const ref = getRouterParam(event, "ref") || "";
  const gone = new AbortController();
  event.node.res.once("close", () => gone.abort());
  const answers = ref ? await OpenQuestions.wait(ref, { signal: gone.signal }) : undefined;
  if (answers) return answers;
  setResponseStatus(event, 204);
  return "";
});
