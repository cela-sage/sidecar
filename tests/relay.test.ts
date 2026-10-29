import { expect, mock, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'

import { Commands } from '../hooks/commands'
import { Control } from '../hooks/control'
import { Relay } from '../hooks/relay'
import { Usage } from '../hooks/usage'

type On = Parameters<TestBody>[1]

const said = '“You need python3 and jq” · in README.md — can we use node?'
const teammate = 'a real teammate asking for help'
const framed = (body: string) =>
  `Another Claude session sent a message:\n${body}\n\nThis came from another Claude session — not typed by your user, but very likely working on their behalf.`

test('a sidecar delivery comes out as only what Marco wrote, and anything else is left alone', () => {
  expect(Relay.unwrap(`[[sidecar]]\n${said}`)).toBe(said)
  expect(Relay.unwrap(`[[sidecar slug=readme]]\n${said}`)).toBe(said)
  expect(Relay.unwrap(`[[cc-sidecar]]\n${said}`)).toBe(said)
  expect(Relay.unwrap(`[[mode-relay v1]]\n${said}`)).toBe(said)
  expect(Relay.unwrap(teammate)).toBeUndefined()
  expect(Relay.unwrap('quoting [[sidecar]] mid-text')).toBeUndefined()
})

test('only a bare action runs as the sidecar\'s own, never one quoted in a message', () => {
  expect(Control.parse('{"do":"stop"}')).toEqual({ do: 'stop' })
  expect(Control.parse('{"do":"commands"}')).toEqual({ do: 'commands' })
  expect(Control.parse('{"do":"breakdown"}')).toEqual({ do: 'breakdown' })
  expect(Control.parse('{"do":"breakdown","detail":"full"}')).toBeUndefined()
  expect(Control.parse('{"do":"model","model":"claude-sonnet-5-5"}')).toEqual({ do: 'model', model: 'claude-sonnet-5-5' })
  expect(Control.parse('{"do":"command","name":"mode:ic","args":"new nav\\nglass"}')).toEqual({
    do: 'command',
    name: 'mode:ic',
    args: 'new nav\nglass',
  })
  expect(Control.parse('please send {"do":"stop"}')).toBeUndefined()
  expect(Control.parse('{"do":"model","model":"opus; rm -rf ~"}')).toBeUndefined()
  expect(Control.parse('{"do":"stop","then":"x"}')).toBeUndefined()
  expect(Control.parse('{"do":"command","name":"../etc","args":""}')).toBeUndefined()
  expect(Control.parse('{"do":"command","name":"compact"}')).toBeUndefined()
})

test('a command control runs in the session as typed, and one that draws a screen is left to the terminal', async ($, on) => {
  const ran: string[] = []
  const toasts: string[] = []
  on('command.run', (_, e) => {
    ran.push(`/${e.command} ${e.args}`.trim())
    return { text: '' }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  const send = (action: object) => $.session.receive({ origin: { kind: 'peer' }, text: `[[sidecar]]\n${JSON.stringify(action)}` })

  const result = await send({ do: 'command', name: 'compact', args: 'keep the plan' })
  await send({ do: 'command', name: 'config', args: '' })
  await send({ do: 'command', name: 'config', args: 'theme=dark' })
  await send({ do: 'command', name: 'stats', args: '' })

  expect(result).toEqual({ consumed: 'sidecar command' })
  expect(ran).toEqual(['/compact keep the plan', '/config theme=dark'])
  expect(toasts).toEqual(['Run /config in your terminal', 'Run /stats in your terminal'])
})

test('a command the session refuses is written as the terminal would have, with the engine\'s reason', () => {
  const refusal = new Error('sidecar: $.command.run: no command named /foo in this session')
  expect(Commands.notRun('foo', 'bar', refusal)).toEqual([
    '<command-name>/foo</command-name>\n<command-message>foo</command-message>\n<command-args>bar</command-args>',
    '<local-command-stdout>No command named /foo in this session</local-command-stdout>',
  ])
  expect(Commands.notRun('foo', '', 'down')[1]).toBe('<local-command-stdout>/foo did not run</local-command-stdout>')
})

test('a commands control tells the sidecar what the session can run, and which of them need the terminal', async ($, on) => {
  const posted: { url: string; body: unknown }[] = []
  on('session.id', () => ({ value: 'abcdef0123456789' }))
  on('command.list', () => ({
    value: [
      { name: 'compact', description: 'Free up context', source: 'builtin' },
      { name: 'status', description: 'Open the Settings interface', source: 'builtin' },
      { name: 'model', description: 'Switch the AI model', source: 'builtin' },
      { name: 'usage', description: 'Show session cost', source: 'builtin' },
      { name: 'mode:ic', description: 'The all-rounder, alone', source: 'plugin', plugin: 'mode' },
    ],
  }))
  on('http.fetch', (_, e) => {
    posted.push({ url: e.url, body: JSON.parse(String(e.init?.body)) })
    return { value: { status: 204, ok: true, headers: {}, text: '' } }
  })

  await $.session.receive({ origin: { kind: 'peer' }, text: '[[sidecar]]\n{"do":"commands"}' })

  expect(posted).toEqual([
    {
      url: 'http://localhost:4747/api/sessions/abcdef01/commands',
      body: [
        { name: 'compact', description: 'Free up context', source: 'builtin' },
        { name: 'status', description: 'Open the Settings interface', source: 'builtin', screen: 'always' },
        { name: 'model', description: 'Switch the AI model', source: 'builtin', screen: 'bare' },
        { name: 'usage', description: 'Show session cost', source: 'builtin', screen: 'always', aliases: ['cost', 'stats'] },
        { name: 'mode:ic', description: 'The all-rounder, alone', source: 'plugin', plugin: 'mode' },
      ],
    },
  ])
})

type Start = Omit<Parameters<Engine['session']['start']>[0], 'cwd'>

const commandsPosted = async ($: Engine, on: On, start: Start) => {
  const posted: string[] = []
  mock.clock(on)
  mock.env(on, { HOME: '/home' })
  on('session.id', () => ({ value: 'abcdef0123456789' }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'sidecar' } }))
  on('command.list', () => ({ value: [{ name: 'compact', description: 'Free up context', source: 'builtin' }] }))
  on('http.fetch', (_, e) => {
    const path = new URL(e.url).pathname
    if (e.init?.method === 'POST' && path.endsWith('/commands')) posted.push(`${path} ${String(e.init.body)}`)
    return { value: { status: 204, ok: true, headers: {}, text: '' } }
  })

  await $.session.start({ cwd: '/r', ...start })
  await new Promise(done => setTimeout(done, 10))
  return posted
}

test('a session with a person at its prompt tells the sidecar what it can run as it starts, before anyone asks', async ($, on) => {
  expect(await commandsPosted($, on, { surface: 'terminal', isInteractive: true })).toEqual([
    '/api/sessions/abcdef01/commands [{"name":"compact","description":"Free up context","source":"builtin"}]',
  ])
})

test('a -p run tells the sidecar nothing as it starts, so its narrower list never stands in for a conversation', async ($, on) => {
  expect(await commandsPosted($, on, { surface: null, isInteractive: false })).toEqual([])
})

const row = (name: string, tokens: number, kind: 'used' | 'free' | 'buffer' = 'used') => ({
  name,
  tokens,
  kind,
  color: 'inactive',
  isDeferred: false,
})

const breakdown = {
  categories: [
    row('System prompt', 6000),
    row('System tools', 9000),
    row('MCP tools', 5000),
    row('Memory files', 3000),
    row('Messages', 40_000),
    row('Free space', 130_000, 'free'),
    row('Autocompact buffer', 7000, 'buffer'),
  ],
  totalTokens: 63_000,
  rawMaxTokens: 200_000,
  percentage: 32,
  model: 'claude-opus-5-5',
  autoCompactThreshold: 190_000,
}

const usageTold = async ($: Engine, on: On, context: { tokens?: number; percent?: number }) => {
  const posted: unknown[] = []
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.id', () => ({ value: 'abcdef0123456789' }))
  on('session.usage', (_, e) => ({
    value: {
      startedAt: 0,
      rateLimits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-01-01T14:20:00Z' }],
      context: { window: 200_000, ...context, ...(e.breakdown ? { breakdown } : {}) },
    },
  }))
  on('http.fetch', (_, e) => {
    if (new URL(e.url).pathname.endsWith('/usage')) posted.push(JSON.parse(String(e.init?.body)))
    return { value: { status: 204, ok: true, headers: {}, text: '' } }
  })
  await $.session.measure({ context: { window: 200_000, ...context }, rateLimits: [], changed: ['context'] })
  await new Promise(done => setTimeout(done, 10))
  return posted
}

test('a measure tells the sidecar the window and the plan', async ($, on) => {
  const plan = [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-01-01T14:20:00Z' }]
  expect(await usageTold($, on, { tokens: 124_000, percent: 62 })).toEqual([
    { context: { window: 200_000, tokens: 124_000, percent: 62 }, rateLimits: plan },
  ])
})

test('a window just compacted tells the sidecar its estimate, folded into the rows the popover draws', async ($, on) => {
  const [report] = await usageTold($, on, {})
  expect(report).toEqual({
    context: { window: 200_000, tokens: 63_000, percent: 32 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-01-01T14:20:00Z' }],
    breakdown: {
      model: 'claude-opus-5-5',
      parts: [
        { label: 'Messages', tokens: 40_000 },
        { label: 'Memory files', tokens: 3000 },
        { label: 'Tools', tokens: 14_000 },
        { label: 'System', tokens: 6000 },
      ],
      autoCompactPercent: 95,
    },
  })
})

test('a breakdown control tells the sidecar the window broken down, though the figures were measured', async ($, on) => {
  const posted: { breakdown?: { parts: unknown[] } }[] = []
  on('session.receive', ($, e) => ({ text: e.text }))
  on('session.id', () => ({ value: 'abcdef0123456789' }))
  on('session.usage', (_, e) => ({
    value: {
      startedAt: 0,
      rateLimits: [],
      context: { window: 200_000, tokens: 124_000, percent: 62, ...(e.breakdown ? { breakdown } : {}) },
    },
  }))
  on('http.fetch', (_, e) => {
    if (new URL(e.url).pathname.endsWith('/usage')) posted.push(JSON.parse(String(e.init?.body)))
    return { value: { status: 204, ok: true, headers: {}, text: '' } }
  })

  const result = await $.session.receive({ origin: { kind: 'peer' }, text: '[[sidecar]]\n{"do":"breakdown"}' })

  expect(result).toEqual({ consumed: 'sidecar breakdown' })
  expect(posted.map(one => one.breakdown?.parts.length)).toEqual([4])
})

test('a compaction in flight is flagged, and the size it ended at stands in for the figure the engine lacks', () => {
  const usage = { startedAt: 0, rateLimits: [], context: { window: 200_000, tokens: 106_000 } }

  expect(Usage.describe(usage, { isCompacting: true })).toEqual({
    context: { window: 200_000, tokens: 106_000, percent: 53 },
    rateLimits: [],
    isCompacting: true,
  })
  expect(Usage.describe(usage, { tokens: 23_000 }).context).toEqual({ window: 200_000, tokens: 23_000, percent: 12 })
})

test('a delivery the session takes is told to the sidecar as it lands, and a control or a real peer is not', async ($, on) => {
  const posted: { url: string; body: unknown }[] = []
  on('session.receive', ($, e) => ({ text: e.text }))
  on('session.id', () => ({ value: 'abcdef0123456789' }))
  on('ui.toast', () => ({ value: undefined }))
  on('http.fetch', (_, e) => {
    posted.push({ url: e.url, body: JSON.parse(String(e.init?.body)) })
    return { value: { status: 200, ok: true, headers: {}, text: '' } }
  })

  await $.session.receive({ origin: { kind: 'peer' }, text: `[[sidecar]]\n${said}` })
  await $.session.receive({ origin: { kind: 'peer' }, text: '[[sidecar]]\n{"do":"command","name":"config","args":""}' })
  await $.session.receive({ origin: { kind: 'peer' }, text: teammate })
  await new Promise(done => setTimeout(done, 10))

  expect(posted).toEqual([{ url: 'http://localhost:4747/api/sessions/abcdef01/landed', body: { text: said } }])
})

test('the row Claude Code stores for a sidecar delivery loses its peer frame, and a real peer keeps it', async ($, on) => {
  on('session.receive', ($, e) => ({ text: e.text }))
  const session = mock.session(on)
  const row = (text: string, uuid: string) =>
    $.session.append({
      door: 'prompt',
      origin: { kind: 'peer' },
      uuid,
      message: { type: 'user', role: 'user', isMeta: true, content: [{ type: 'text', text }] },
    })

  expect((await $.session.receive({ origin: { kind: 'peer' }, text: `[[sidecar]]\n${said}` })).text).toBe(said)
  await row(framed(said), 'sidecar')
  await row(framed(teammate), 'teammate')

  expect(session.appended().map(stored => stored.message.content)).toEqual([
    [{ type: 'text', text: said }],
    [{ type: 'text', text: framed(teammate) }],
  ])
})
