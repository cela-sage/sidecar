import { EventEmitter, once } from "node:events";
import z from "zod";
import type { SessionCommand } from "../../../shared/types/command.ts";
import { deliver } from "./inbox.ts";

const ANSWER_MS = 3_000;

const List = z.array(
  z.object({
    name: z.string().min(1),
    description: z.string(),
    source: z.enum(["builtin", "plugin", "user", "mcp"]),
    screen: z.enum(["always", "bare"]).optional(),
    aliases: z.array(z.string()).optional(),
  }),
) satisfies z.ZodType<SessionCommand[]>;

const answers = new EventEmitter<Record<string, [SessionCommand[]]>>();

// Only the session knows its commands, and which skills and plugins it has changes under a running one, so each ask goes to it.
const ask = async (key: string): Promise<SessionCommand[] | undefined> => {
  const stop = new AbortController();
  const answered = once(answers, key, { signal: AbortSignal.any([stop.signal, AbortSignal.timeout(ANSWER_MS)]) });
  const sent = await deliver({ key, text: JSON.stringify({ do: "commands" }) });
  if (!sent.delivered) stop.abort();
  const [commands] = await answered.catch(() => []);
  return commands;
};

const answer = (key: string, commands: SessionCommand[]): void => {
  answers.emit(key, commands);
};

export const SessionCommands = { answer, ask, List };
