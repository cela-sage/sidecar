import { OpenQuestions, type QuestionAnswers } from "~~/server/utils/sessions/questions";

export default defineEventHandler(async (event): Promise<QuestionAnswers | ""> => {
  const ref = getRouterParam(event, "ref") || "";
  if (!OpenQuestions.has(ref)) {
    setResponseStatus(event, 404);
    return "";
  }
  const gone = new AbortController();
  event.node.res.once("close", () => gone.abort());
  const answers = await OpenQuestions.wait(ref, { signal: gone.signal });
  if (answers) return answers;
  setResponseStatus(event, 204);
  return "";
});
