import { OpenQuestions } from "~~/server/utils/sessions/questions";

export default defineEventHandler((event): { closed: true } => {
  OpenQuestions.close(getRouterParam(event, "ref") || "");
  return { closed: true };
});
