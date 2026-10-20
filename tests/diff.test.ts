import { expect, test } from 'claude-code/testing'

import { Diff } from '../hooks/review/diff'

const text = (...lines: string[]): string => `${lines.join('\n')}\n`

test('finds the minimal changes between two texts', () => {
  const before = Diff.textOf(text('a', 'b', 'c', 'd', 'e'))
  const after = Diff.textOf(text('a', 'B', 'c', 'e', 'f'))
  expect(Diff.lines(before.lines, after.lines)).toEqual([
    { oldStart: 1, oldEnd: 2, newStart: 1, newEnd: 2 },
    { oldStart: 3, oldEnd: 4, newStart: 3, newEnd: 3 },
    { oldStart: 5, oldEnd: 5, newStart: 4, newEnd: 5 },
  ])
})

test('picking one row of a hunk moves only that row, in place', () => {
  const original = Diff.textOf(text('a', 'b', 'c', 'd'))
  const current = Diff.textOf(text('a', 'B', 'C', 'd', 'e'))
  const row = { original, current, old: [1], new: [1] }
  expect(Diff.sourceOf(Diff.pick({ ...row, isAccept: true }))).toBe(text('a', 'B', 'c', 'd'))
  expect(Diff.sourceOf(Diff.pick({ ...row, isAccept: false }))).toBe(text('a', 'b', 'C', 'd', 'e'))
  expect(Diff.sourceOf(Diff.pick({ original, current, old: [], new: [4], isAccept: true }))).toBe(text('a', 'b', 'c', 'd', 'e'))
})

test('rebuilds what a shell command started from out of its hunks', () => {
  const after = Diff.textOf(text('one', 'two', 'TWO', 'four'))
  const hunks = [{ newStart: 1, newLines: 4, lines: [' one', ' two', '-three', '+TWO', ' four'] }]
  expect(Diff.sourceOf(Diff.unapply(after, hunks)!)).toBe(text('one', 'two', 'three', 'four'))
  expect(Diff.unapply(Diff.textOf(text('unrelated')), hunks)).toBeUndefined()
})
