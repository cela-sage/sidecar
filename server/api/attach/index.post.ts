import z from "zod";
import { isKey } from "~~/server/utils/sessions/paths";
import { Terminal } from "~~/server/utils/terminal";

const Body = z.object({ key: z.string().toLowerCase().refine(isKey, "a session's 8-hex key") });

export default defineEventHandler(async (event): Promise<{ sent: true }> => {
  const { key } = await readValidatedBody(event, (raw) => Body.parse(raw));
  if (!Terminal.attach(key))
    throw createError({ statusCode: 409, statusMessage: "refused", message: "no sidecar terminal is following" });
  return { sent: true };
});
