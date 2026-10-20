export type ReviewTracked = {
  turns: number[]
  blob?: string
}

/** One decision as it can be undone: the paths' ledger entries and disk blobs either side of it; no blob is no file. */
export type ReviewStep = {
  label: string
  paths: string[]
  before: Record<string, ReviewTracked>
  after: Record<string, ReviewTracked>
  disk: { path: string; before?: string; after?: string }[]
}

export type ReviewLedger = {
  dir: string
  turn: number
  revision: number
  files: Record<string, ReviewTracked>
  undo: ReviewStep[]
  redo: ReviewStep[]
}

// What the sidecar relays as the whole body under `[[sidecar]]`; line numbers are 1-based, as a person reads them.
export type ReviewAction =
  | { do: 'approve' | 'reject'; paths: string[] }
  | { do: 'accept-lines' | 'reject-lines'; path: string; old: number[]; new: number[] }
  | { do: 'undo' | 'redo' }

declare module 'claude-code' {
  interface PluginState {
    sidecar: {
      review: ReviewLedger
    }
  }
}
