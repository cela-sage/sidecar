import type { EngineInterface } from 'claude-code'

import { Question } from './question'
import type { QuestionPort } from './question'

const SIDECAR_DOWN_RETRY_MS = 5000

// `$` may only be spelled at a call site, so the session.start hook hands these over as closures.
export type DoorHost = {
  id: EngineInterface['session']['id']
  fetch: EngineInterface['http']['fetch']
  sleep: EngineInterface['clock']['sleep']
}

export type DoorAsk = { ref: string; questions: unknown; signal: AbortSignal }

export type Opened = { port: QuestionPort; close: () => void }

export interface Door {
  open: (ask: DoorAsk) => Promise<Opened>
}

const create = (api: string, host: DoorHost): Door => ({
  open: async ({ ref, questions, signal }) => {
    const asked = `${api}/api/questions/${encodeURIComponent(ref)}`
    const close = () => void host.fetch(asked, { method: 'DELETE' }).catch(() => undefined)
    const key = (await host.id()).slice(0, 8)
    void host
      .fetch(asked, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, questions }),
      })
      .catch(() => undefined)
    signal.addEventListener('abort', close, { once: true })
    return {
      close,
      port: {
        poll: async () => {
          const res = await host.fetch(`${asked}/answer`).catch(() => undefined)
          if (!res?.ok) return 'down'
          return (res.status === 200 && Question.answersOf(res.text)) || 'idle'
        },
        rest: () => host.sleep(SIDECAR_DOWN_RETRY_MS, { signal }).catch(() => undefined),
        isGone: () => signal.aborted,
      },
    }
  },
})

export const Door = { create }
