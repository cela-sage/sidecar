import { isKey } from "~~/server/utils/sessions/paths";
import { SessionCommands } from "~~/server/utils/sessions/commands";
import type { SessionCommand } from "~~/shared/types/command";

export default defineEventHandler((event): SessionCommand[] => {
  const key = getRouterParam(event, "key") || "";
  if (!isKey(key)) return [];
  SessionCommands.refresh(key);
  return SessionCommands.held(key);
});
