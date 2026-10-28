import { OpenQuestions, type AskedQuestion } from "~~/server/utils/sessions/questions";

export default defineEventHandler((): AskedQuestion[] => OpenQuestions.open());
