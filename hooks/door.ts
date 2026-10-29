import type { EngineInterface } from 'claude-code'

import { Question } from './question'
import type { QuestionPort } from './question'

const SIDECAR_DOWN_RETRY_MS = 5000

// Closures, since `$` is spelled only at a call site; the rest is a `$` call because a clock wait spends the hook's 10s budget.
export type DoorHost = {
  id: EngineInterface['session']['id']
  fetch: EngineInterface['http']['fetch']
  rest: (ms: number) => Promise<void>
}

export type DoorAsk = { ref: string; questions: unknown; signal: AbortSignal }

export type Opened = { port: QuestionPort; close: () => void }

export interface Door {
  open: (ask: DoorAsk) => Promise<Opened>
}

// A restarted sidecar has forgotten the ask, so a 404 on the poll announces it again, and a delete waits for that.
const create = (api: string, host: DoorHost): Door => ({
  open: async ({ ref, questions, signal }) => {
    const asked = `${api}/api/questions/${encodeURIComponent(ref)}`
    const key = (await host.id()).slice(0, 8)
    const announce = () =>
      host
        .fetch(asked, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key, questions }),
        })
        .catch(() => undefined)
    let announced = announce()
    let isClosed = false
    const close = () => {
      isClosed = true
      void announced.then(() => host.fetch(asked, { method: 'DELETE' })).catch(() => undefined)
    }
    signal.addEventListener('abort', close, { once: true })
    return {
      close,
      port: {
        poll: async () => {
          await announced
          const res = await host.fetch(`${asked}/answer`).catch(() => undefined)
          if (res?.status === 404 && !isClosed) {
            announced = announce()
            return (await announced)?.ok ? 'idle' : 'down'
          }
          if (!res?.ok) return 'down'
          return (res.status === 200 && Question.answersOf(res.text)) || 'idle'
        },
        rest: () => host.rest(SIDECAR_DOWN_RETRY_MS).catch(() => undefined),
        isGone: () => signal.aborted,
      },
    }
  },
})

export const Door = { create }
