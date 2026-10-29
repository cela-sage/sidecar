import { expect, mock, test } from 'claude-code/testing'

import { Commands } from '../hooks/commands'
import { Control } from '../hooks/control'
import { Relay } from '../hooks/relay'

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
      ],
    },
  ])
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
