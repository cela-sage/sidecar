import type { ProcessRunInit, ProcessRunResult } from 'claude-code'

import type { ReviewLedger } from '../../types'

export type Cell<T> = {
  get: () => Promise<T>
  update: (change: (value: T) => T) => Promise<unknown>
}

// Everything the mod reaches outside itself: register.tsx builds it, since only a hook may spell `$`.
export type Port = {
  ledger: Cell<ReviewLedger>
  read: (path: string) => Promise<string>
  write: (path: string, text: string) => Promise<void>
  exists: (path: string) => Promise<boolean>
  run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>
  now: () => Promise<number>
  home: () => Promise<string>
  tell: (text: string) => Promise<unknown>
  toast: (text: string) => void
}
