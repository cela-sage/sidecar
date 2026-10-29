import type { CommandInfo } from 'claude-code'

export interface SessionCommand {
  name: string
  description: string
  source: CommandInfo['source']
  plugin?: string
  screen?: 'always' | 'bare'
  aliases?: string[]
}

// The engine flags none of these, so they are listed by hand from the commands reference.
const ALWAYS = new Set([
  'artifacts', 'bug', 'context', 'copy', 'diff', 'feedback', 'help', 'hooks', 'ide', 'install-github-app',
  'keybindings', 'login', 'memory', 'permissions', 'powerup', 'privacy-settings', 'rate-limit-options',
  'release-notes', 'remote-env', 'resume', 'rewind', 'scroll-speed', 'setup-bedrock', 'setup-vertex', 'skills',
  'status', 'tasks', 'teleport', 'theme', 'usage', 'workflows',
])
const BARE = new Set(['add-dir', 'btw', 'cd', 'config', 'export', 'mcp', 'model', 'plugin'])

// The engine lists a command under one name only, though it runs by any of these.
const ALIASES: Record<string, string[]> = {
  config: ['settings'],
  permissions: ['allowed-tools'],
  resume: ['continue'],
  rewind: ['checkpoint', 'undo'],
  tasks: ['bashes'],
  usage: ['cost', 'stats'],
}

const canonical = (name: string): string => Object.keys(ALIASES).find(one => ALIASES[one]?.includes(name)) ?? name

const screenOf = (name: string): SessionCommand['screen'] => {
  if (ALWAYS.has(name)) return 'always'
  return BARE.has(name) ? 'bare' : undefined
}

export const Commands = {
  describe: (list: CommandInfo[]): SessionCommand[] =>
    list.map(({ name, description, source, plugin }) => {
      const screen = screenOf(name)
      const aliases = ALIASES[name]
      return {
        name,
        description,
        source,
        ...(plugin ? { plugin } : {}),
        ...(screen ? { screen } : {}),
        ...(aliases ? { aliases } : {}),
      }
    }),

  needsTerminal: (name: string, args: string): boolean => {
    const screen = screenOf(canonical(name))
    return screen === 'always' || (screen === 'bare' && !args)
  },

  notRun: (name: string, args: string, error: unknown): string[] => {
    const said = error instanceof Error ? (error.message.split(': ').at(-1) ?? '') : ''
    const reason = said ? `${said.charAt(0).toUpperCase()}${said.slice(1)}` : `/${name} did not run`
    return [
      `<command-name>/${name}</command-name>\n<command-message>${name}</command-message>\n<command-args>${args}</command-args>`,
      `<local-command-stdout>${reason}</local-command-stdout>`,
    ]
  },
}
