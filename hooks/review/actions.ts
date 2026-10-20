import type { ReviewAction } from '../../types'
import { Ledger, spanOf } from './ledger'
import type { Port } from './port'

export type RunOptions = {
  action: ReviewAction
  shown: (path: string) => string
}

const isNumbers = (value: unknown): value is number[] => Array.isArray(value) && value.every(Number.isInteger)
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')

const isAction = (value: unknown): value is ReviewAction => {
  if (typeof value !== 'object' || !value || !('do' in value)) return false
  const action = value as Record<string, unknown>
  if (action.do === 'undo' || action.do === 'redo') return true
  if (action.do === 'approve' || action.do === 'reject') return isStrings(action.paths)
  if (action.do === 'accept-lines' || action.do === 'reject-lines')
    return typeof action.path === 'string' && isNumbers(action.old) && isNumbers(action.new)
  return false
}

const zeroBased = (lines: readonly number[]): number[] => lines.map(line => line - 1)

const commonDir = (paths: readonly string[]): string => {
  const [first = '', ...rest] = paths.map(path => path.slice(0, path.lastIndexOf('/')))
  let common = first
  for (const dir of rest) while (common && dir !== common && !dir.startsWith(`${common}/`)) common = common.slice(0, common.lastIndexOf('/'))
  return common
}

// Several paths read as a count and the folder they share, so the undo tooltip stays one short line.
const filesOf = (paths: readonly string[], shown: (path: string) => string): string => {
  const [only] = paths
  if (paths.length === 1 && only) return shown(only)
  const where = shown(`${commonDir(paths)}/`)
  return `${paths.length} files${where ? ` in ${where}` : ''}`
}

export const Actions = {
  // The whole body under [[sidecar]] has to be the action, so a note that quotes one is never run.
  parse(body: string): ReviewAction | undefined {
    const json = body.trim()
    if (!json.startsWith('{')) return undefined
    try {
      const value: unknown = JSON.parse(json)
      return isAction(value) ? value : undefined
    } catch {
      return undefined
    }
  },

  async run(port: Port, { action, shown }: RunOptions): Promise<void> {
    switch (action.do) {
      case 'undo':
      case 'redo':
        return Ledger.travel(port, { way: action.do, shown })
      case 'approve':
      case 'reject': {
        const verb = action.do === 'approve' ? 'approving' : 'rejecting'
        const label = `${verb} ${filesOf(action.paths, shown)}`
        return Ledger.record(port, { label, paths: action.paths }, () =>
          action.do === 'approve' ? Ledger.approve(port, action.paths) : Ledger.reject(port, { paths: action.paths, shown }),
        )
      }
      case 'accept-lines':
      case 'reject-lines': {
        const [old, picked] = [zeroBased(action.old), zeroBased(action.new)]
        const isAccept = action.do === 'accept-lines'
        const which = picked.length > 0 ? spanOf(picked) : `the removed original ${spanOf(old)}`
        const label = `${isAccept ? 'accepting' : 'rejecting'} ${which} of ${shown(action.path)}`
        return Ledger.record(port, { label, paths: [action.path] }, () =>
          Ledger.lines(port, { path: action.path, old, new: picked, isAccept, shown: shown(action.path) }),
        )
      }
    }
  },
}
