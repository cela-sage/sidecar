import { SessionCommands } from "~~/server/utils/sessions/commands";
import type { SessionCommand } from "~~/shared/types/command";

export default defineEventHandler(async (event): Promise<SessionCommand[]> => {
  const key = getRouterParam(event, "key") || "";
  return (key && (await SessionCommands.ask(key))) || [];
});
