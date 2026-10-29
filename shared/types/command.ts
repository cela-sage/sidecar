export type CommandSource = "builtin" | "plugin" | "user" | "mcp";

// `always` draws a screen only the terminal can show, `bare` does so only when typed without arguments.
export type CommandScreen = "always" | "bare";

export interface SessionCommand {
  name: string;
  description: string;
  source: CommandSource;
  plugin?: string;
  screen?: CommandScreen;
  aliases?: string[];
}
