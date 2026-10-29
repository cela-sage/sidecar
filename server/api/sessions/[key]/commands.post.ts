import { isKey } from "~~/server/utils/sessions/paths";
import { SessionCommands } from "~~/server/utils/sessions/commands";

export default defineEventHandler(async (event): Promise<{ heard: boolean }> => {
  const key = getRouterParam(event, "key") || "";
  const commands = SessionCommands.List.safeParse(await readBody(event));
  if (!isKey(key) || !commands.success) return { heard: false };
  SessionCommands.answer(key, commands.data);
  return { heard: true };
});
