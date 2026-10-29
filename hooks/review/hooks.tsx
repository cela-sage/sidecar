import type { Register } from 'claude-code'

import { Seen } from '../seen'
import { Actions } from './actions'
import { Ledger } from './ledger'
import type { Port } from './port'

export type ReviewStart = { cwd: string; port: Port; sessionId: string }

// The hook's own `$.session.id()`, since `$` may only be spelled at the call site; asked only for an action.
export type ReviewDelivery = { text: string; sessionId: () => Promise<string> }

type Around = { sessionId: Promise<string>; path: string }

// A plugin hooks each event once, so the main loop's turn id reaches the sidecar's Stop through here.
export type ReviewHooks = {
  answered: (sessionId: string, answer: string) => Promise<unknown>
  turned: (turnId?: string) => void
}

// Bookkeeping must never fail the edit itself, so a broken baseline only costs the review.
const quietly = (work: Promise<unknown>): Promise<unknown> => work.catch(() => undefined)

let port: Port | undefined
let cwd = ''

const absolute = (path: string): string => (path.startsWith('/') ? path : `${cwd}/${path}`)
const shown = (path: string): string => (path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path)

// Asked at every entry, since a /clear changes the id with no session.start and a compaction can land mid-turn.
const ready = async (sessionId: Promise<string>): Promise<Port | undefined> => {
  const at = port
  await quietly(sessionId.then(id => at && Ledger.follow(at, id)))
  return at
}

const around = async <T,>({ sessionId, path }: Around, run: () => Promise<T>): Promise<T> => {
  const at = await ready(sessionId)
  if (!at) return run()
  await quietly(Ledger.baseline(at, path))
  const ran = await run()
  await quietly(Ledger.touched(at, path))
  return ran
}

// The sidecar's own session.start builds the port, since a plugin takes one hook per event and only a hook spells `$`.
export const startReview = async (start: ReviewStart): Promise<void> => {
  cwd = start.cwd
  port = start.port
  await quietly(Ledger.open(port, start.sessionId))
}

// One hooks module per plugin, so the sidecar's register.tsx hands its `on` over to these.
export const registerReview = (on: Parameters<Register>[0], { answered, turned }: ReviewHooks): void => {
  on('turn.start', async ($, e, next) => {
    if (!e.agentId) turned(e.turnId)
    const sessionId = $.session.id()
    const at = await ready(sessionId)
    if (at) await quietly(Ledger.beginTurn(at))
    if (at) await quietly(sessionId.then(id => Seen.mark(at, id)))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) turned()
    const sessionId = $.session.id()
    const at = await ready(sessionId)
    if (at) await quietly(Ledger.recheck(at))
    if (!e.agentId && e.reason === 'answer' && e.answer.trim()) void quietly(sessionId.then(id => answered(id, e.answer)))
    return next(e)
  })

  on('tool.call', { tool: 'Edit' }, ($, e, next) =>
    around({ sessionId: $.session.id(), path: absolute(e.file_path) }, () => next(e)),
  ).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, ($, e, next) =>
    around({ sessionId: $.session.id(), path: absolute(e.file_path) }, () => next(e)),
  ).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'NotebookEdit' }, ($, e, next) =>
    around({ sessionId: $.session.id(), path: absolute(e.notebook_path) }, () => next(e)),
  ).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const files = ran.isError || ran.deny ? undefined : ran.result?.bashEditDiff?.files
    if (!files?.length) return ran
    const at = await ready($.session.id())
    if (!at) return ran
    for (const file of files) {
      const path = absolute(file.filePath)
      await quietly(Ledger.baselineFromPatch(at, path, file.hunks))
      await quietly(Ledger.touched(at, path))
    }
    return ran
  }).catch(($, e, next) => next(e))
}

// The sidecar's Review buttons arrive as relayed messages; running them here keeps them out of the conversation.
export const receiveReview = async ({ text, sessionId }: ReviewDelivery): Promise<boolean> => {
  const action = Actions.parse(text)
  if (!action) return false
  const at = await ready(sessionId())
  if (!at) return false
  await Actions.run(at, { action, shown }).catch(() => at.toast(`The sidecar review could not ${action.do} that`))
  return true
}
