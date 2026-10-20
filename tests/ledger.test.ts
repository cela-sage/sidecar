import { expect, test } from 'claude-code/testing'

import type { ReviewLedger } from '../types'
import { Relay } from '../hooks/relay'
import { Actions } from '../hooks/review/actions'
import { EMPTY_LEDGER, Ledger } from '../hooks/review/ledger'
import type { Port } from '../hooks/review/port'

type Memory = { port: Port; disk: Map<string, string>; told: string[] }

const memory = (files: Record<string, string>): Memory => {
  const disk = new Map(Object.entries(files))
  const told: string[] = []
  let ledger: ReviewLedger = EMPTY_LEDGER
  const port: Port = {
    ledger: { get: async () => ledger, update: async change => (ledger = change(ledger)) },
    read: async path => {
      if (!disk.has(path)) throw new Error(`ENOENT ${path}`)
      return disk.get(path)!
    },
    write: async (path, text) => void disk.set(path, text),
    exists: async path => disk.has(path),
    run: async argv => {
      if (argv[0] === 'rm') disk.delete(argv.at(-1)!)
      return { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
    },
    now: async () => 7,
    home: async () => '/home',
    tell: async text => told.push(text),
    toast: () => undefined,
  }
  return { port, disk, told }
}

const edit = async ({ port, disk }: Memory, path: string, text: string): Promise<void> => {
  await Ledger.baseline(port, path)
  disk.set(path, text)
  await Ledger.touched(port, path)
}

const pending = async ({ port }: Memory): Promise<Record<string, number[]>> =>
  Object.fromEntries(Object.entries((await port.ledger.get()).files).map(([path, tracked]) => [path, tracked.turns]))

test('the review is the union of every unapproved turn, and approving one file leaves the rest', async () => {
  const world = memory({ '/r/a': 'a\n', '/r/b': 'b\n', '/r/c': 'c\n' })
  await Ledger.open(world.port, 'session')

  await Ledger.beginTurn(world.port)
  await edit(world, '/r/a', 'a1\n')
  await edit(world, '/r/b', 'b1\n')
  await Ledger.beginTurn(world.port)
  await edit(world, '/r/b', 'b2\n')
  await edit(world, '/r/c', 'c2\n')
  expect(await pending(world)).toEqual({ '/r/a': [1], '/r/b': [1, 2], '/r/c': [2] })

  await Ledger.approve(world.port, ['/r/a'])
  expect(Object.keys(await pending(world))).toEqual(['/r/b', '/r/c'])

  await Ledger.beginTurn(world.port)
  await edit(world, '/r/a', 'a3\n')
  const pair = await Ledger.pair(world.port, '/r/a')
  expect(pair?.original.lines).toEqual(['a1'])
  expect(pair?.current.lines).toEqual(['a3'])

  await Ledger.approve(world.port, Object.keys(await pending(world)))
  expect(await pending(world)).toEqual({})
  expect(JSON.parse(world.disk.get('/home/.claude/sidecar/review/session/review.json')!).files).toEqual({})
})

test('a review begun in the old turn-diff folder carries on there, and a new one starts in sidecar', async () => {
  const old = memory({ '/home/.claude/turn-diff/session/review.json': JSON.stringify({ turn: 4, files: {} }) })
  await Ledger.open(old.port, 'session')
  expect((await old.port.ledger.get()).dir).toBe('/home/.claude/turn-diff/session')
  expect((await old.port.ledger.get()).turn).toBe(4)

  const fresh = memory({})
  await Ledger.open(fresh.port, 'session')
  expect((await fresh.port.ledger.get()).dir).toBe('/home/.claude/sidecar/review/session')
})

test('after a /clear the review moves to the new session id, and state emptied under the same id reloads from disk', async () => {
  const world = memory({ '/r/a': 'a\n' })
  await Ledger.open(world.port, 'session')
  await Ledger.beginTurn(world.port)
  await edit(world, '/r/a', 'a1\n')

  await world.port.ledger.update(() => EMPTY_LEDGER)
  await Ledger.follow(world.port, 'session')
  expect(await pending(world)).toEqual({ '/r/a': [1] })

  await Ledger.follow(world.port, 'cleared')
  expect((await world.port.ledger.get()).dir).toBe('/home/.claude/sidecar/review/cleared')
  expect(await pending(world)).toEqual({})
  await Ledger.beginTurn(world.port)
  await edit(world, '/r/b', 'b\n')
  expect(JSON.parse(world.disk.get('/home/.claude/sidecar/review/cleared/review.json')!).files).toHaveProperty('/r/b')
})

test('rejecting restores the original, deletes a file Claude created and tells Claude', async () => {
  const world = memory({ '/r/a': 'a\n' })
  await Ledger.open(world.port, 'session')
  await Ledger.beginTurn(world.port)
  await edit(world, '/r/a', 'changed\n')
  await edit(world, '/r/new', 'fresh\n')

  await Ledger.reject(world.port, { paths: ['/r/a', '/r/new'], shown: path => path.slice(3) })

  expect(world.disk.get('/r/a')).toBe('a\n')
  expect(world.disk.has('/r/new')).toBe(false)
  expect(world.disk.get('/home/.claude/sidecar/review/session/rejected/7/r/a')).toBe('changed\n')
  expect(await pending(world)).toEqual({})
  expect(world.told[0]).toContain('a, new (new, so deleted)')
})

test('accepting lines moves the original and leaves the disk, rejecting lines rewrites the file and tells Claude', async () => {
  const world = memory({ '/r/a': 'one\ntwo\nthree\n' })
  await Ledger.open(world.port, 'session')
  await Ledger.beginTurn(world.port)
  await edit(world, '/r/a', 'ONE\ntwo\nTHREE\n')

  await Ledger.lines(world.port, { path: '/r/a', old: [0], new: [0], isAccept: true, shown: 'a' })
  expect(world.disk.get('/r/a')).toBe('ONE\ntwo\nTHREE\n')
  expect((await Ledger.pair(world.port, '/r/a'))?.original.lines).toEqual(['ONE', 'two', 'three'])
  expect(world.told).toEqual([])

  await Ledger.lines(world.port, { path: '/r/a', old: [2], new: [2], isAccept: false, shown: 'a' })
  expect(world.disk.get('/r/a')).toBe('ONE\ntwo\nthree\n')
  expect(await pending(world)).toEqual({})
  expect(world.told[0]).toContain('rejected line 3 of a')
})

test('a sidecar action is the whole body under [[sidecar]], and runs in 1-based lines', async () => {
  const world = memory({ '/r/a': 'one\ntwo\n' })
  await Ledger.open(world.port, 'session')
  await edit(world, '/r/a', 'one\nTWO\n')
  const body = Relay.unwrap('[[sidecar]]\n{"do":"reject-lines","path":"/r/a","old":[2],"new":[2]}') ?? ''

  const action = Actions.parse(body)
  expect(action).toEqual({ do: 'reject-lines', path: '/r/a', old: [2], new: [2] })
  await Actions.run(world.port, { action: action!, shown: path => path.slice(3) })

  expect(world.disk.get('/r/a')).toBe('one\ntwo\n')
  expect(Actions.parse('{"do":"delete","paths":[]}')).toBeUndefined()
  expect(Actions.parse('can you undo {"do":"undo"} for me')).toBeUndefined()
  expect(Actions.parse('just a message')).toBeUndefined()
})

test('a press over several files is labelled by their count and the folder they share, one file by its path', async () => {
  const world = memory({ '/r/x/a': 'a\n', '/r/x/y/b': 'b\n', '/r/c': 'c\n', '/r/d': 'd\n' })
  const shown = (path: string) => (path.startsWith('/r/') ? path.slice(3) : path)
  await Ledger.open(world.port, 'session')
  for (const path of ['/r/x/a', '/r/x/y/b', '/r/c', '/r/d']) await edit(world, path, 'changed\n')

  await Actions.run(world.port, { action: { do: 'approve', paths: ['/r/x/a', '/r/x/y/b'] }, shown })
  await Actions.run(world.port, { action: { do: 'reject', paths: ['/r/c', '/r/d'] }, shown })
  await Actions.run(world.port, { action: { do: 'undo' }, shown })
  await Actions.run(world.port, { action: { do: 'approve', paths: ['/r/c'] }, shown })

  expect((await world.port.ledger.get()).undo.map(step => step.label)).toEqual(['approving 2 files in x/', 'approving c'])
  expect(world.told.at(-1)).toContain('undid rejecting 2 files in the sidecar review')
})

test('undo puts a reject back and tells Claude, redo applies it again, and a file edited since is left alone', async () => {
  const world = memory({ '/r/a': 'one\ntwo\n' })
  const run = (json: string) => Actions.run(world.port, { action: Actions.parse(json)!, shown: path => path.slice(3) })
  await Ledger.open(world.port, 'session')
  await Ledger.beginTurn(world.port)
  await edit(world, '/r/a', 'one\nTWO\n')

  await run('{"do":"reject-lines","path":"/r/a","old":[2],"new":[2]}')
  expect(world.disk.get('/r/a')).toBe('one\ntwo\n')
  expect((await world.port.ledger.get()).undo.map(step => step.label)).toEqual(['rejecting line 2 of a'])

  await run('{"do":"undo"}')
  expect(world.disk.get('/r/a')).toBe('one\nTWO\n')
  expect(Object.keys(await pending(world))).toEqual(['/r/a'])
  expect(world.told.at(-1)).toContain('undid rejecting line 2 of a')

  await run('{"do":"redo"}')
  expect(world.disk.get('/r/a')).toBe('one\ntwo\n')
  expect(await pending(world)).toEqual({})

  await run('{"do":"undo"}')
  await run('{"do":"approve","paths":["/r/a"]}')
  expect((await world.port.ledger.get()).redo).toEqual([])
  await run('{"do":"undo"}')
  expect(Object.keys(await pending(world))).toEqual(['/r/a'])

  await run('{"do":"reject","paths":["/r/a"]}')
  world.disk.set('/r/a', 'edited after\n')
  await run('{"do":"undo"}')
  expect(world.disk.get('/r/a')).toBe('edited after\n')
  expect(JSON.parse(world.disk.get('/home/.claude/sidecar/review/session/review.json')!).undo.at(-1).label).toBe('rejecting a')
})
