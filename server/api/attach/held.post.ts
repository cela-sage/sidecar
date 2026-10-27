import z from "zod";
import { isKey } from "~~/server/utils/sessions/paths";
import { Terminal } from "~~/server/utils/terminal";
import type { TerminalState } from "~~/shared/types/events";

const Body = z.object({ key: z.string().toLowerCase().refine(isKey, "a session's 8-hex key").optional() });

export default defineEventHandler(async (event): Promise<TerminalState> => {
  const { key } = await readValidatedBody(event, (raw) => Body.parse(raw ?? {}));
  return Terminal.hold(key);
});
