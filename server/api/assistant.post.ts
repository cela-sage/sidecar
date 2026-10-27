import z from "zod";
import { Assistant } from "~~/server/utils/sessions/assistant";
import type { Started } from "~~/shared/types/assistant";

const Body = z.object({ text: z.string().trim().min(1), slug: z.string().min(1).optional() });

export default defineEventHandler(async (event): Promise<Started> => {
  const body = await readValidatedBody(event, (raw) => Body.parse(raw));
  return Assistant.start(body);
});
