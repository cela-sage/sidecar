import { expect, mock, test } from 'claude-code/testing'

const ran = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

test("a main-loop answer and what Marco types reach the task history, and a subagent's or a peer's never does", async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { HOME: '/home' })
  const heard: { argv: readonly string[]; stdin?: string }[] = []
  on('session.id', () => ({ value: 'aaaaaaaa-1111-2222-3333-444444444444' }))
  on('command.register', () => ({ value: { command: 'sidecar' } }))
  on('process.run', ($, e) => {
    if (e.argv.includes('--heard')) heard.push({ argv: e.argv.slice(-3), stdin: e.init?.stdin })
    return { value: ran }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('prompt.submit', ($, e) => ({ text: e.text }))

  await $.session.start({ cwd: '/r', surface: null, isInteractive: false })
  const end = { durationMs: 1, isAborted: false, turnId: 't' }
  await $.turn.complete({ ...end, answer: 'The lane works end to end.', reason: 'answer' })
  await $.turn.complete({ ...end, answer: 'a subagent report', reason: 'answer', agentId: 'agent-1' })
  await $.turn.complete({ ...end, answer: 'cut short', reason: 'aborted', isAborted: true })
  await $.prompt.submit({ text: 'call it task, not board', origin: { kind: 'composer' }, wait: false })
  await $.prompt.submit({ text: 'a relayed note', origin: { kind: 'peer' }, wait: false })
  await clock.settle()

  expect(heard).toEqual([
    { argv: ['task', '--heard', 'turn'], stdin: 'The lane works end to end.' },
    { argv: ['task', '--heard', 'message'], stdin: 'call it task, not board' },
  ])
})
