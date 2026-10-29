import type { SessionCommand } from "../types/command.ts";

export interface SlashCommand {
  name: string;
  args: string;
}

const NAME = /^[A-Za-z0-9][\w:.-]{0,63}$/;
// A path never matches: a "/" always follows the token there, never whitespace or end.
const COMMAND = /^\/([^\s/]+)(?:\s+([\s\S]*))?$/;

const parse = (text: string): SlashCommand | undefined => {
  const [, name = "", args = ""] = COMMAND.exec(text.trim()) ?? [];
  return NAME.test(name) ? { name, args: args.trim() } : undefined;
};

const line = ({ name, args }: SlashCommand): string => `/${name}${args ? ` ${args}` : ""}`;

const isName = (name: string): boolean => NAME.test(name);

const needsTerminal = ({ screen }: Pick<SessionCommand, "screen">, args: string): boolean =>
  screen === "always" || (screen === "bare" && !args);

export const SlashCommand = { isName, line, needsTerminal, parse };
