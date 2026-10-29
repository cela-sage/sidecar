import type { PermissionRequestDecision } from 'claude-code'

import type { Answers } from './question'

type Rule = NonNullable<Extract<PermissionRequestDecision, { behavior: 'allow' }>['updatedPermissions']>[number]

export type Request = { tool_name: string; tool_input: unknown; permission_suggestions?: readonly Rule[] }

export interface Ask {
  question: string
  header: string
  options: { label: string; description?: string }[]
}

const ONCE = 'Allow once'
const ALWAYS = 'Allow always'
const NO = 'No'
const BRIEF_MAX = 600
const SHOWN = ['command', 'file_path', 'notebook_path', 'url', 'path', 'pattern', 'query']

export const OWN_FLOW = new Set(['AskUserQuestion', 'ExitPlanMode'])

const WHERE: Record<Rule['destination'], string> = {
  userSettings: 'your user settings',
  projectSettings: 'the project settings',
  localSettings: 'your local settings',
  session: 'this session',
  cliArg: 'this run',
}

const briefOf = (input: unknown): string => {
  const fields: Record<string, unknown> = typeof input === 'object' && input ? { ...input } : {}
  const named = SHOWN.map(key => fields[key]).find(value => typeof value === 'string' && value)
  return (typeof named === 'string' ? named : (JSON.stringify(input) ?? '')).slice(0, BRIEF_MAX)
}

const lineOf = (one: Rule): string => {
  const where = WHERE[one.destination]
  if (one.type === 'addRules' && one.behavior === 'allow') {
    const rules = one.rules.map(({ toolName, ruleContent }) => (ruleContent ? `${toolName}(${ruleContent})` : toolName))
    return `Allows ${rules.join(', ')} in ${where}`
  }
  if (one.type === 'setMode') return `Switches to ${one.mode} in ${where}`
  if (one.type === 'addDirectories') return `Adds ${one.directories.join(', ')} in ${where}`
  return `Changes ${where}`
}

const askOf = ({ tool_name, tool_input, permission_suggestions = [] }: Request): Ask => {
  const brief = briefOf(tool_input)
  return {
    header: tool_name,
    question: brief ? `Allow ${tool_name}: ${brief}?` : `Allow ${tool_name}?`,
    options: [
      { label: ONCE, description: 'Just this call' },
      ...(permission_suggestions.length
        ? [{ label: ALWAYS, description: permission_suggestions.map(lineOf).join('. ') }]
        : []),
      { label: NO },
    ],
  }
}

// Anything but a recognised allow denies, so a stray answer never lets a tool run.
const decide = ({ permission_suggestions }: Request, answers: Answers): PermissionRequestDecision => {
  const [pick] = Object.values(answers)
  if (pick === ONCE) return { behavior: 'allow' }
  if (pick === ALWAYS && permission_suggestions?.length) {
    return { behavior: 'allow', updatedPermissions: [...permission_suggestions] }
  }
  return { behavior: 'deny', message: 'Denied from the sidecar' }
}

type Waiting = { key: string; settle: () => void }

const waiting: Waiting[] = []

const keyOf = ({ tool_name, tool_input }: Request): string => `${tool_name} ${JSON.stringify(tool_input)}`

// A Yes in the terminal leaves the hook running, and the tool's own result is the only sign of it.
const wait = (request: Request, settle: () => void): (() => void) => {
  const one = { key: keyOf(request), settle }
  waiting.push(one)
  return () => {
    const at = waiting.indexOf(one)
    if (at >= 0) waiting.splice(at, 1)
  }
}

const ran = (request: Request): void => {
  const at = waiting.findIndex(one => one.key === keyOf(request))
  if (at >= 0) waiting.splice(at, 1)[0]?.settle()
}

const turnEnded = (): void => {
  for (const one of waiting.splice(0)) one.settle()
}

export const Permission = { askOf, decide, ran, turnEnded, wait }
