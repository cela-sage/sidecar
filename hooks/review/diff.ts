export type Change = {
  oldStart: number
  oldEnd: number
  newStart: number
  newEnd: number
}

export type Text = {
  lines: string[]
  hasEol: boolean
}

export type PickOptions = {
  original: Text
  current: Text
  old: readonly number[]
  new: readonly number[]
  isAccept: boolean
}

export type PatchHunk = {
  newStart: number
  newLines: number
  lines: string[]
}

const MAX_EDITS = 4000

const textOf = (source?: string): Text =>
  !source
    ? { lines: [], hasEol: false }
    : {
        lines: (source.endsWith('\n') ? source.slice(0, -1) : source).split('\n'),
        hasEol: source.endsWith('\n'),
      }

const sourceOf = ({ lines, hasEol }: Text): string =>
  lines.length === 0 ? '' : lines.join('\n') + (hasEol ? '\n' : '')

export const Diff = {
  textOf,
  sourceOf,

  lines(a: readonly string[], b: readonly string[]): Change[] {
    let start = 0
    while (start < a.length && start < b.length && a[start] === b[start]) start++
    let endA = a.length
    let endB = b.length
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
      endA--
      endB--
    }
    const ids = new Map<string, number>()
    const idOf = (line: string): number => {
      if (!ids.has(line)) ids.set(line, ids.size)
      return ids.get(line)!
    }
    const inner = shortestScript(a.slice(start, endA).map(idOf), b.slice(start, endB).map(idOf))
    return inner.map(change => ({
      oldStart: change.oldStart + start,
      oldEnd: change.oldEnd + start,
      newStart: change.newStart + start,
      newEnd: change.newEnd + start,
    }))
  },

  // Walked row by row, as the review pairs them, so a picked line lands where its row sits.
  pick({ original, current, old, new: picked, isAccept }: PickOptions): Text {
    const target = isAccept ? original : current
    const lines = [...target.lines]
    for (const change of Diff.lines(original.lines, current.lines).reverse()) {
      const merged: string[] = []
      for (let k = 0; k < Math.max(change.oldEnd - change.oldStart, change.newEnd - change.newStart); k++) {
        const was = change.oldStart + k
        const now = change.newStart + k
        if (was < change.oldEnd && old.includes(was) !== isAccept) merged.push(original.lines[was]!)
        if (now < change.newEnd && picked.includes(now) === isAccept) merged.push(current.lines[now]!)
      }
      if (isAccept) lines.splice(change.oldStart, change.oldEnd - change.oldStart, ...merged)
      else lines.splice(change.newStart, change.newEnd - change.newStart, ...merged)
    }
    const source = target.lines.length > 0 ? target : isAccept ? current : original
    return { lines, hasEol: source.hasEol }
  },

  // Rebuilds the text a Bash command started from, out of the hunks it reported against the result.
  unapply(after: Text, hunks: readonly PatchHunk[]): Text | undefined {
    const text = { lines: [...after.lines], hasEol: after.hasEol }
    let hadEol = text.hasEol
    for (const hunk of [...hunks].reverse()) {
      const body = hunk.lines.filter(line => !line.startsWith('\\'))
      const removedSide = body.filter(line => !line.startsWith('+')).map(line => line.slice(1))
      const addedSide = body.filter(line => !line.startsWith('-')).map(line => line.slice(1))
      const near = hunk.newLines === 0 ? hunk.newStart : hunk.newStart - 1
      const at = locate(text.lines, addedSide, Math.max(0, near))
      if (at < 0) return undefined
      text.lines.splice(at, addedSide.length, ...removedSide)
      hunk.lines.forEach((line, i) => {
        if (!line.startsWith('\\')) return
        const before = hunk.lines[i - 1]?.[0]
        if (before === '-' || before === ' ') hadEol = false
        if (before === '+') hadEol = true
      })
    }
    return { lines: text.lines, hasEol: hadEol }
  },
}

const locate = (lines: readonly string[], block: readonly string[], near: number): number => {
  const fits = (at: number): boolean =>
    at >= 0 && at + block.length <= lines.length && block.every((line, i) => lines[at + i] === line)
  for (let distance = 0; distance <= 50; distance++) {
    if (fits(near + distance)) return near + distance
    if (fits(near - distance)) return near - distance
  }
  return -1
}

const shortestScript = (a: readonly number[], b: readonly number[]): Change[] => {
  const n = a.length
  const m = b.length
  const whole: Change[] = [{ oldStart: 0, oldEnd: n, newStart: 0, newEnd: m }]
  if (n === 0 && m === 0) return []
  if (n === 0 || m === 0) return whole
  const max = Math.min(n + m, MAX_EDITS)
  const offset = max + 1
  const v = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice(offset - d - 1, offset + d + 2))
    for (let k = -d; k <= d; k += 2) {
      const isDown = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)
      let x = isDown ? v[offset + k + 1]! : v[offset + k - 1]! + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) return changesOf(trace, n, m)
    }
  }
  return whole
}

const changesOf = (trace: readonly Int32Array[], n: number, m: number): Change[] => {
  const edits: { x: number; y: number; isInsert: boolean }[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d > 0; d--) {
    const band = trace[d]!
    const at = (k: number): number => band[k + d + 1]!
    const k = x - y
    const isDown = k === -d || (k !== d && at(k - 1) < at(k + 1))
    const previousK = isDown ? k + 1 : k - 1
    const previousX = at(previousK)
    const previousY = previousX - previousK
    edits.push({ x: previousX, y: previousY, isInsert: isDown })
    x = previousX
    y = previousY
  }
  const changes: Change[] = []
  for (const edit of edits.reverse()) {
    const oldEnd = edit.isInsert ? edit.x : edit.x + 1
    const newEnd = edit.isInsert ? edit.y + 1 : edit.y
    const last = changes.at(-1)
    if (last && last.oldEnd === edit.x && last.newEnd === edit.y) {
      last.oldEnd = oldEnd
      last.newEnd = newEnd
    } else {
      changes.push({ oldStart: edit.x, oldEnd, newStart: edit.y, newEnd })
    }
  }
  return changes
}
