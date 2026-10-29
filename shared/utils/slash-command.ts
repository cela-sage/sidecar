import type { SessionCommand } from "../types/command.ts";

export interface CommandCall {
  name: string;
  args: string;
}

const NAME = /^[A-Za-z0-9][\w:.-]{0,63}$/;
// A path never matches: a "/" always follows the token there, never whitespace or end.
const COMMAND = /^\/([^\s/]+)(?:\s+([\s\S]*))?$/;

const parse = (text: string): CommandCall | undefined => {
  const [, name = "", args = ""] = COMMAND.exec(text.trim()) ?? [];
  return NAME.test(name) ? { name, args: args.trim() } : undefined;
};

const line = ({ name, args }: CommandCall): string => `/${name}${args ? ` ${args}` : ""}`;

const isName = (name: string): boolean => NAME.test(name);

const needsTerminal = ({ screen }: Pick<SessionCommand, "screen">, args: string): boolean =>
  screen === "always" || (screen === "bare" && !args);

const tagOf = ({ source, plugin }: Pick<SessionCommand, "source" | "plugin">): string | undefined => {
  if (source === "builtin") return undefined;
  return source === "plugin" ? (plugin ?? source) : source;
};

const TYPING =/^\/([^\s/]*)$/;

const typing = (text: string): { query: string } | undefined => {
  const hit = TYPING.exec(text);
  return hit ? { query: hit[1] ?? "" } : undefined;
};

const MATCHES_MAX = 30;

const matching = (list: SessionCommand[], query: string): SessionCommand[] => {
  const needle = query.toLowerCase();
  const names = list.filter((one) => one.name.toLowerCase().includes(needle));
  const starts = names.filter((one) => one.name.toLowerCase().startsWith(needle));
  return [...starts, ...names.filter((one) => !starts.includes(one))].slice(0, MATCHES_MAX);
};

export const SlashCommand = { isName, line, matching, needsTerminal, parse, tagOf, typing };
