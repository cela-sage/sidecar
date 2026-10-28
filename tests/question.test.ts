import { expect, test } from 'claude-code/testing'

import { Question, type Heard } from '../hooks/question'

const PICK = { 'Which color?': 'Blue' }
const never = new Promise<string>(() => undefined)

const port = (heard: Heard[], gone = () => false) => {
  let rests = 0
  let polls = 0
  return {
    port: {
      poll: async () => heard[polls++] ?? 'idle',
      rest: async () => {
        rests += 1
      },
      isGone: gone,
    },
    rests: () => rests,
    polls: () => polls,
  }
}

test('the door wins when its answer arrives while the dialog is still open', async () => {
  const { port: door } = port(['idle', PICK])
  expect(await Question.race(never, door)).toEqual({ from: 'door', answers: PICK })
})

test('the dialog wins when the terminal answers first, and the door stops polling', async () => {
  let answer: (text: string) => void = () => undefined
  const dialog = new Promise<string>(done => (answer = done))
  const held: Heard[] = []
  const door = port(held)
  const raced = Question.race(dialog, door.port)
  answer('Large')
  expect(await raced).toEqual({ from: 'dialog', result: 'Large' })
  const polled = door.polls()
  await new Promise(done => setTimeout(done, 10))
  expect(door.polls()).toBe(polled)
})

test('a sidecar that is down is retried after a rest', async () => {
  const door = port(['down', 'down', PICK])
  expect(await Question.race(never, door.port)).toEqual({ from: 'door', answers: PICK })
  expect(door.rests()).toBe(2)
})

test('an interrupted call stops waiting for the door', async () => {
  let isGone = false
  const door = port(['idle'], () => isGone)
  const raced = Question.race(never, { ...door.port, poll: async () => ((isGone = true), 'idle') })
  expect(await raced).toEqual({ from: 'gone' })
})

test('only an object of strings reads as answers', () => {
  expect(Question.answersOf(JSON.stringify(PICK))).toEqual(PICK)
  expect(Question.answersOf('[]')).toBeUndefined()
  expect(Question.answersOf('{"a": 1}')).toBeUndefined()
  expect(Question.answersOf('')).toBeUndefined()
})
