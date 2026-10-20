import type { ReviewLedger, ReviewStep, ReviewTracked } from '../../types'
import { Diff } from './diff'
import type { Change, PatchHunk, Text } from './diff'
import type { Port } from './port'

type Content = { text: string }
type Shown = (path: string) => string

export type RejectOptions = {
  paths: readonly string[]
  shown: Shown
}

// Line indices are 0-based here; the sidecar's 1-based numbers are converted at the edge.
export type LinesOptions = {
  path: string
  old: readonly number[]
  new: readonly number[]
  isAccept: boolean
  shown: string
}

export type RecordOptions = {
  label: string
  paths: readonly string[]
}

export type TravelOptions = {
  way: 'undo' | 'redo'
  shown: Shown
}

export type Pair = {
  path: string
  original: Text
  current: Text
  isNew: boolean
  isDeleted: boolean
  changes: Change[]
}

type Snapshot = { files: Record<string, ReviewTracked>; disk: Map<string, string> }

export const EMPTY_LEDGER: ReviewLedger = { dir: '', turn: 0, revision: 0, files: {}, undo: [], redo: [] }

const MAX_BYTES = 4 * 1024 * 1024
const HISTORY = 50

let saving: Promise<void> = Promise.resolve()

const contentOf = async (port: Port, path: string): Promise<Content | undefined> =>
  (await port.exists(path)) ? { text: await port.read(path) } : undefined

const isSame = (a?: Content, b?: Content): boolean => (!a || !b ? !a && !b : a.text === b.text)

const blobPath = (dir: string, blob: string): string => `${dir}/blobs/${blob}`

const hashOf = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

const isReviewable = (content?: Content): boolean =>
  !content || (content.text.length < MAX_BYTES && !content.text.includes('\u0000'))

const originalOf = async (port: Port, dir: string, tracked: ReviewTracked): Promise<Content | undefined> =>
  tracked.blob ? { text: await port.read(blobPath(dir, tracked.blob)) } : undefined

const without = (files: ReviewLedger['files'], paths: readonly string[]): ReviewLedger['files'] =>
  Object.fromEntries(Object.entries(files).filter(([path]) => !paths.includes(path)))

const only = (files: ReviewLedger['files'], paths: readonly string[]): ReviewLedger['files'] =>
  Object.fromEntries(Object.entries(files).filter(([path]) => paths.includes(path)))

const mutate = async (port: Port, change: (ledger: ReviewLedger) => ReviewLedger): Promise<void> => {
  await port.ledger.update(current => ({ ...change(current), revision: current.revision + 1 }))
  await Ledger.save(port)
}

const store = async (port: Port, text: string): Promise<string> => {
  const { dir } = await port.ledger.get()
  const blob = await hashOf(text)
  if (!(await port.exists(blobPath(dir, blob)))) await port.write(blobPath(dir, blob), text)
  return blob
}

const remember = async (port: Port, path: string, original?: Content): Promise<void> => {
  if (!isReviewable(original)) return
  const blob = original && (await store(port, original.text))
  await mutate(port, current =>
    current.files[path]
      ? current
      : { ...current, files: { ...current.files, [path]: blob ? { turns: [], blob } : { turns: [] } } },
  )
}

const isSettled = async (port: Port, path: string): Promise<boolean> => {
  const { dir, files } = await port.ledger.get()
  const tracked = files[path]
  return !tracked || isSame(await originalOf(port, dir, tracked), await contentOf(port, path))
}

const snapshotOf = async (port: Port, paths: readonly string[]): Promise<Snapshot> => {
  const disk = new Map<string, string>()
  for (const path of paths) {
    const content = await contentOf(port, path)
    if (content && isReviewable(content)) disk.set(path, await store(port, content.text))
  }
  return { files: only((await port.ledger.get()).files, paths), disk }
}

const blobText = async (port: Port, blob = ''): Promise<Content | undefined> =>
  blob ? { text: await port.read(blobPath((await port.ledger.get()).dir, blob)) } : undefined

export const spanOf = (numbers: readonly number[]): string => {
  const sorted = [...numbers].sort((a, b) => a - b).map(n => n + 1)
  const isRun = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1)
  if (sorted.length === 1) return `line ${sorted[0]}`
  return isRun ? `lines ${sorted[0]}-${sorted.at(-1)}` : `lines ${sorted.join(', ')}`
}

export const Ledger = {
  async open(port: Port, id: string): Promise<void> {
    const root = `${await port.home()}/.claude`
    const legacy = `${root}/turn-diff/${id}`
    const fresh = `${root}/sidecar/review/${id}`
    // A review begun in turn-diff's folder carries on there, so its history is not split across two.
    const isFresh = await contentOf(port, `${fresh}/review.json`)
    const isLegacy = await contentOf(port, `${legacy}/review.json`)
    const dir = !isFresh && isLegacy ? legacy : fresh
    const saved = await contentOf(port, `${dir}/review.json`)
    const parsed = saved ? (JSON.parse(saved.text) as Partial<ReviewLedger>) : {}
    await port.ledger.update(current => ({
      dir,
      turn: parsed.turn ?? 0,
      revision: current.revision + 1,
      files: parsed.files ?? {},
      undo: parsed.undo ?? [],
      redo: parsed.redo ?? [],
    }))
  },

  // A /clear carries on under a new session id with no session.start, so the ledger reopens for whichever id is live.
  async follow(port: Port, id: string): Promise<void> {
    if (!(await port.ledger.get()).dir.endsWith(`/${id}`)) await Ledger.open(port, id)
  },

  save(port: Port): Promise<void> {
    saving = saving
      .then(async () => {
        const { dir, turn, files, undo, redo } = await port.ledger.get()
        if (!dir) return
        await port.write(`${dir}/review.json`, JSON.stringify({ turn, files, undo, redo }))
      })
      .catch(() => undefined)
    return saving
  },

  async beginTurn(port: Port): Promise<void> {
    await mutate(port, current => ({ ...current, turn: current.turn + 1 }))
  },

  async baseline(port: Port, path: string): Promise<void> {
    if ((await port.ledger.get()).files[path]) return
    await remember(port, path, await contentOf(port, path))
  },

  // A Bash command reports its hunks after it ran, so the left side is rebuilt from them.
  async baselineFromPatch(port: Port, path: string, hunks: readonly PatchHunk[]): Promise<void> {
    if ((await port.ledger.get()).files[path]) return
    const isCreated = hunks.every(hunk => hunk.lines.every(line => line.startsWith('+') || line.startsWith('\\')))
    if (isCreated) return remember(port, path)
    const after = await contentOf(port, path)
    const original = Diff.unapply(Diff.textOf(after?.text), hunks)
    if (original) await remember(port, path, { text: Diff.sourceOf(original) })
  },

  async touched(port: Port, path: string): Promise<void> {
    const { turn, files } = await port.ledger.get()
    const tracked = files[path]
    if (!tracked) return
    if (await isSettled(port, path)) return mutate(port, current => ({ ...current, files: without(current.files, [path]) }))
    if (tracked.turns.includes(turn)) return mutate(port, current => current)
    await mutate(port, current => {
      const now = current.files[path]
      if (!now || now.turns.includes(turn)) return current
      return { ...current, files: { ...current.files, [path]: { ...now, turns: [...now.turns, turn] } } }
    })
  },

  async recheck(port: Port): Promise<void> {
    for (const path of Object.keys((await port.ledger.get()).files)) await Ledger.touched(port, path)
  },

  async pair(port: Port, path: string): Promise<Pair | undefined> {
    const { dir, files } = await port.ledger.get()
    const tracked = files[path]
    if (!tracked) return undefined
    const [original, current] = await Promise.all([originalOf(port, dir, tracked), contentOf(port, path)])
    const before = Diff.textOf(original?.text)
    const after = Diff.textOf(current?.text)
    return {
      path,
      original: before,
      current: after,
      isNew: !tracked.blob,
      isDeleted: !current,
      changes: Diff.lines(before.lines, after.lines),
    }
  },

  async approve(port: Port, paths: readonly string[]): Promise<void> {
    await mutate(port, current => ({ ...current, files: without(current.files, paths) }))
  },

  async reject(port: Port, { paths, shown }: RejectOptions): Promise<void> {
    const { dir, files } = await port.ledger.get()
    const now = await port.now()
    const undone: string[] = []
    for (const path of paths) {
      const tracked = files[path]
      if (!tracked) continue
      const current = await contentOf(port, path)
      if (current) await port.write(`${dir}/rejected/${now}${path}`, current.text)
      const original = await originalOf(port, dir, tracked)
      if (original) await port.write(path, original.text)
      else await port.run(['rm', '-f', '--', path])
      undone.push(`${shown(path)}${original ? '' : ' (new, so deleted)'}`)
    }
    await mutate(port, current => ({ ...current, files: without(current.files, paths) }))
    if (undone.length > 0) {
      await port.tell(
        `Marco rejected your changes in the sidecar review, so these files are back to how they were before you touched them: ${undone.join(', ')}. Re-read a file before editing it again.`,
      )
    }
  },

  // Accepting moves the original forward and leaves the disk alone; rejecting rewrites the file and tells Claude.
  async lines(port: Port, { path, old, new: picked, isAccept, shown }: LinesOptions): Promise<void> {
    const pair = await Ledger.pair(port, path)
    if (!pair || (old.length === 0 && picked.length === 0)) return
    const merged = Diff.sourceOf(Diff.pick({ original: pair.original, current: pair.current, old, new: picked, isAccept }))
    if (isAccept) {
      const blob = await store(port, merged)
      await mutate(port, current => {
        const now = current.files[path]
        return now ? { ...current, files: { ...current.files, [path]: { ...now, blob } } } : current
      })
    } else {
      const { dir } = await port.ledger.get()
      const before = await contentOf(port, path)
      if (before) await port.write(`${dir}/rejected/${await port.now()}${path}`, before.text)
      await port.write(path, merged)
    }
    if (await isSettled(port, path)) await mutate(port, current => ({ ...current, files: without(current.files, [path]) }))
    if (isAccept) return
    const which = picked.length > 0 ? spanOf(picked) : `the removed original ${spanOf(old)}`
    await port.tell(
      `Marco rejected ${which} of ${shown} in the sidecar review, and the file has the original there again. Re-read it before editing it again.`,
    )
  },

  // Both sides of what a decision touched are kept, so the sidecar can put either one back.
  async record(port: Port, { label, paths }: RecordOptions, decide: () => Promise<void>): Promise<void> {
    const before = await snapshotOf(port, paths)
    await decide()
    const after = await snapshotOf(port, paths)
    const disk = paths.flatMap(path => {
      const [was, is] = [before.disk.get(path), after.disk.get(path)]
      return was === is ? [] : [{ path, ...(was && { before: was }), ...(is && { after: is }) }]
    })
    if (!disk.length && JSON.stringify(before.files) === JSON.stringify(after.files)) return
    const step: ReviewStep = { label, paths: [...paths], before: before.files, after: after.files, disk }
    await mutate(port, current => ({ ...current, undo: [...current.undo, step].slice(-HISTORY), redo: [] }))
  },

  // A file edited since the decision would lose that edit, so the step waits until the disk matches it again.
  async travel(port: Port, { way, shown }: TravelOptions): Promise<void> {
    const step = (await port.ledger.get())[way].at(-1)
    if (!step) return
    const [from, to] = way === 'undo' ? (['after', 'before'] as const) : (['before', 'after'] as const)
    for (const sides of step.disk) {
      if (!isSame(await contentOf(port, sides.path), await blobText(port, sides[from]))) {
        port.toast(`${shown(sides.path)} changed after ${step.label}, so the sidecar cannot ${way} it`)
        return
      }
    }
    for (const sides of step.disk) {
      const content = await blobText(port, sides[to])
      if (content) await port.write(sides.path, content.text)
      else await port.run(['rm', '-f', '--', sides.path])
    }
    await mutate(port, current => ({
      ...current,
      files: { ...without(current.files, step.paths), ...step[to] },
      undo: way === 'undo' ? current.undo.slice(0, -1) : [...current.undo, step],
      redo: way === 'undo' ? [...current.redo, step] : current.redo.slice(0, -1),
    }))
    if (!step.disk.length) return
    await port.tell(
      `Marco ${way === 'undo' ? 'undid' : 'redid'} ${step.label} in the sidecar review, which rewrote ${step.disk.map(sides => shown(sides.path)).join(', ')} on disk. Re-read a file before editing it again.`,
    )
  },
}
