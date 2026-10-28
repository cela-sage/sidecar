import z from "zod";
import { isKey } from "~~/server/utils/sessions/paths";
import { retitle } from "~~/server/utils/sessions/title";
import type { Retitled } from "~~/shared/types/session";

const Body = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .regex(/^[^\n]+$/),
});

export default defineEventHandler(async (event): Promise<Retitled> => {
  const key = getRouterParam(event, "key") || "";
  if (!isKey(key)) throw createError({ statusCode: 400, statusMessage: "invalid key" });
  const { title } = await readValidatedBody(event, (raw) => Body.parse(raw ?? {}));
  if (!(await retitle({ key, title }))) throw createError({ statusCode: 404, statusMessage: "no such conversation" });
  return { key, title };
});
