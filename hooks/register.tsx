import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { Relay } from './relay'
import { receiveReview, registerReview, startReview } from './review/hooks'
import { EMPTY_LEDGER } from './review/ledger'

const reviewLedger = atom({ plugin: 'sidecar', key: 'review' } as const, EMPTY_LEDGER)

// Each call takes the live session id, since a /clear moves the process to a new one without a session.start.
type Sidecar = {
  point: (id: string) => Promise<void>
  run: (args: string, id: string) => Promise<string>
}

// A burst of keys points once, and a keystroke never waits on the network.
const POINT_EVERY_MS = 2000

let sidecar: Sidecar | undefined
let pointed = 0
let rule: string | undefined
const relayed: string[] = []

export const register: Register = (on, options) => {
  const url = String(options.url ?? 'http://sidecar.localhost:4747').replace(/\/$/, '')
  // Chrome reads the named *.localhost; the mod's own calls take bare localhost, the loopback host it is known to reach.
  const api = url.replace(/^(https?:\/\/)[^/:]+\.localhost\b/, '$1localhost')
  registerReview(on)

  on('session.start', async ($, e, next) => {
    const id = await $.session.id()
    const home = (await $.env.get('HOME')) ?? ''
    const cli = `${$.plugin.root}/bin/sidecar`
    sidecar = {
      point: async id => {
        await $.http
          .fetch(`${api}/api/follow`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ key: id.slice(0, 8), source: 'prompt' }),
          })
          .catch(() => undefined)
      },
      // The session id is what the CLI reads inside a session, so /sidecar <args> is exactly `sidecar <args>` run here.
      run: async (args, id) => {
        const argv = ['env', `SIDECAR_URL=${url}`, `CLAUDE_CODE_SESSION_ID=${id}`, cli, ...args.split(/\s+/).filter(Boolean)]
        const ran = await $.process.run(argv, { timeoutMs: 120_000 }).catch(() => undefined)
        if (!ran) return `The sidecar CLI did not run: ${cli}`
        return [ran.stdout, ran.stderr].map(text => text.trim()).filter(Boolean).join('\n')
      },
    }
    await $.command.register({
      name: 'sidecar',
      description: 'The sidecar CLI: bare opens the sidecar on this conversation, starting it when it is down',
      argumentHint: '[open|comments|status|start|stop|restart|setup|uninstall|import|help]',
    })
    await startReview({
      cwd: e.cwd,
      sessionId: id,
      port: {
        ledger: { get: () => read($, reviewLedger), update: change => update($, reviewLedger, change) },
        read: path => $.fs.read(path),
        write: (path, text) => $.fs.write(path, text),
        exists: path => $.fs.exists(path),
        run: (argv, init) => $.process.run(argv, init),
        now: () => $.clock.now(),
        home: async () => home,
        tell: text => $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } }),
        toast: text => $.ui.toast(text),
      },
    })
    return next(e)
  })

  // A delivery from the sidecar lands as Marco's own words: the marker comes off here, the peer frame off its row.
  on('session.receive', async ($, e, next) => {
    const body = Relay.unwrap(e.text)
    if (!body) return next(e)
    if (await receiveReview({ text: body, sessionId: () => $.session.id() })) return { consumed: 'sidecar review action' }
    relayed.push(body)
    return next({ ...e, text: body })
  })

  // Claude Code frames the delivery as another session's only when it stores the row, after session.receive.
  on('session.append', { door: 'prompt', origin: { kind: 'peer' } }, async ($, e, next) => {
    const [block, ...rest] = e.message.content
    const text = block?.type === 'text' && !rest.length ? block.text : undefined
    const body = typeof text === 'string' ? Relay.unframe(text) : undefined
    const at = body ? relayed.indexOf(body) : -1
    if (!body || at < 0) return next(e)
    relayed.splice(at, 1)
    return next({ ...e, message: { ...e.message, content: [{ type: 'text', text: body }] } })
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    rule ??= (await $.fs.read(`${$.plugin.root}/rules/sidecar.md`).catch(() => ''))
      .trim()
      .replaceAll('{{cli}}', `${$.plugin.root}/bin/sidecar`)
    if (!rule) return composed
    return { sections: [...composed.sections, { id: 'sidecar:rule', text: rule, scope: 'session' }] }
  })

  on('command.run', { command: 'sidecar' }, async ($, e) => ({
    text: sidecar ? await sidecar.run(e.args, await $.session.id()) :'The sidecar mod is still starting, try again in a moment.',
  }))

  on('prompt.edit', async ($, e, next) => {
    const now = await $.clock.now()
    if (sidecar && now - pointed >= POINT_EVERY_MS) {
      pointed = now
      const { point } = sidecar
      void $.session.id().then(point)
    }
    return next(e)
  })
}
