import z from "zod";
import { isKey } from "~~/server/utils/sessions/paths";
import { Seen } from "~~/server/utils/sessions/seen";

const Body = z.object({ endedAt: z.number() });

export default defineEventHandler(async (event): Promise<void> => {
  const key = getRouterParam(event, "key") || "";
  if (!isKey(key)) throw createError({ statusCode: 400, statusMessage: "invalid key" });
  const { endedAt } = await readValidatedBody(event, (raw) => Body.parse(raw ?? {}));
  Seen.see(key, endedAt);
  setResponseStatus(event, 204);
});
