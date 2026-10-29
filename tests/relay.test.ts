import { expect, mock, test } from 'claude-code/testing'

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

test('only a bare Stop or model action runs as the sidecar\'s own, never one quoted in a message', () => {
  expect(Control.parse('{"do":"stop"}')).toEqual({ do: 'stop' })
  expect(Control.parse('{"do":"model","model":"claude-sonnet-5-5"}')).toEqual({ do: 'model', model: 'claude-sonnet-5-5' })
  expect(Control.parse('please send {"do":"stop"}')).toBeUndefined()
  expect(Control.parse('{"do":"model","model":"opus; rm -rf ~"}')).toBeUndefined()
  expect(Control.parse('{"do":"stop","then":"x"}')).toBeUndefined()
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
