import { expect, mock, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'

import { Permission } from '../hooks/permission'
import type { Request } from '../hooks/permission'

const RULES: NonNullable<Request['permission_suggestions']>[number] = {
  type: 'addRules',
  behavior: 'allow',
  destination: 'localSettings',
  rules: [{ toolName: 'Bash', ruleContent: 'git push:*' }],
}
const PUSH = { tool_name: 'Bash', tool_input: { command: 'git push origin main' }, permission_suggestions: [RULES] }
const QUESTION = 'Allow Bash: git push origin main?'

type On = Parameters<TestBody>[1]

test('a prompt reads as a question with the tool, the ask and the rules it would write', () => {
  const { header, question, options } = Permission.askOf(PUSH)
  expect(header).toBe('Bash')
  expect(question).toBe(QUESTION)
  expect(options).toEqual([
    { label: 'Allow once', description: 'Just this call' },
    { label: 'Allow always', description: 'Allows Bash(git push:*) in your local settings' },
    { label: 'No' },
  ])
  expect(Permission.askOf({ tool_name: 'Read', tool_input: { file_path: '/a' } }).options.map(one => one.label)).toEqual([
    'Allow once',
    'No',
  ])
})

test('only a recognised allow lets the tool run, and Allow always writes the suggested rules', () => {
  expect(Permission.decide(PUSH, { [QUESTION]: 'Allow once' })).toEqual({ behavior: 'allow' })
  expect(Permission.decide(PUSH, { [QUESTION]: 'Allow always' })).toEqual({ behavior: 'allow', updatedPermissions: [RULES] })
  expect(Permission.decide(PUSH, { [QUESTION]: 'No' }).behavior).toBe('deny')
  expect(Permission.decide(PUSH, { [QUESTION]: 'Allow always?' }).behavior).toBe('deny')
  expect(Permission.decide({ ...PUSH, permission_suggestions: [] }, { [QUESTION]: 'Allow always' }).behavior).toBe('deny')
  expect(Permission.decide(PUSH, {}).behavior).toBe('deny')
})

const sidecar = async ($: Engine, on: On, pick: () => string | undefined) => {
  const calls: string[] = []
  const asked: unknown[] = []
  mock.clock(on)
  mock.env(on, { HOME: '/home' })
  on('session.id', () => ({ value: 'abcdef0123456789' }))
  on('command.register', () => ({ value: { command: 'sidecar' } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.PermissionRequest', () => ({}))
  on('classic.PostToolUse', () => ({}))
  on('http.fetch', async (_, e) => {
    const method = e.init?.method ?? 'GET'
    calls.push(`${method} ${new URL(e.url).pathname.split('/').slice(2).join('/')}`)
    if (method === 'POST') asked.push(JSON.parse(String(e.init?.body)))
    if (method === 'GET') await new Promise(done => setTimeout(done, 5))
    const picked = method === 'GET' ? pick() : undefined
    return {
      value: { status: picked ? 200 : 204, ok: true, headers: {}, text: picked ? JSON.stringify({ [QUESTION]: picked }) : '' },
    }
  })
  await $.session.start({ cwd: '/r', surface: null, isInteractive: false })
  return { calls, asked }
}

test("a pick in the sidecar's chat answers the dialog, and the question closes", async ($, on) => {
  let pick: string | undefined
  const { calls, asked } = await sidecar($, on, () => pick)
  setTimeout(() => (pick = 'Allow always'), 12)

  const result = await $.classic.PermissionRequest(PUSH)

  expect(result).toEqual({ decision: { behavior: 'allow', updatedPermissions: [RULES] } })
  expect(asked).toEqual([{ key: 'abcdef01', questions: [Permission.askOf(PUSH)] }])
  expect(calls.at(-1)).toMatch(/^DELETE questions\/permission-/)
})

test("a Yes in the terminal ends the wait when the tool's result arrives", async ($, on) => {
  const { calls } = await sidecar($, on, () => undefined)
  const waiting = $.classic.PermissionRequest(PUSH)
  await new Promise(done => setTimeout(done, 12))

  await $.classic.PostToolUse({ ...PUSH, tool_response: '', tool_use_id: 'toolu_1' })

  expect(await waiting).toEqual({})
  expect(calls.at(-1)).toMatch(/^DELETE questions\/permission-/)
})

test('a tool with a flow of its own is left to it', async ($, on) => {
  const { calls } = await sidecar($, on, () => 'Allow once')

  expect(await $.classic.PermissionRequest({ tool_name: 'AskUserQuestion', tool_input: {} })).toEqual({})
  expect(calls).toEqual([])
})
