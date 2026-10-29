import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { Commands } from './commands'
import { Control } from './control'
import { Door } from './door'
import { OWN_FLOW, Permission } from './permission'
import { Question } from './question'
import { Relay } from './relay'
import { receiveReview, registerReview, startReview, stopTurn } from './review/hooks'
import { EMPTY_LEDGER } from './review/ledger'

const reviewLedger = atom({ plugin: 'sidecar', key: 'review' } as const, EMPTY_LEDGER)
// Held by the host rather than the module, since a reload between a delivery and its row resets module variables.
const relayed = atom({ plugin: 'sidecar', key: 'relayed' } as const, [] as string[])

// Each call takes the live session id, since a /clear moves the process to a new one without a session.start.
type Sidecar = {
  point: (id: string) => Promise<void>
  run: (args: string, id: string) => Promise<string>
  hear: (kind: 'turn' | 'message', text: string, id: string) => Promise<unknown>
}

// A burst of keys points once, and a keystroke never waits on the network.
const POINT_EVERY_MS = 2000

let sidecar: Sidecar | undefined
let door: Door | undefined
let pointed = 0
let rule: string | undefined

const tellCommands = async ($: EngineInterface, api: string): Promise<void> => {
  const [list, id] = await Promise.all([$.command.list(), $.session.id()])
  void $.http
    .fetch(`${api}/api/sessions/${id.slice(0, 8)}/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Commands.describe(list)),
    })
    .catch(() => undefined)
}

export const register: Register = (on, options) => {
  const url = String(options.url ?? 'http://sidecar.localhost:4747').replace(/\/$/, '')
  // Chrome reads the named *.localhost; the mod's own calls take bare localhost, the loopback host it is known to reach.
  const api = url.replace(/^(https?:\/\/)[^/:]+\.localhost\b/, '$1localhost')
  registerReview(on, {
    answered: async (id, answer) => sidecar?.hear('turn', answer, id),
  })

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
      hear: (kind, text, id) =>
        $.process
          .run(['env', `SIDECAR_URL=${url}`, `CLAUDE_CODE_SESSION_ID=${id}`, cli, 'task', '--heard', kind], {
            stdin: text,
            timeoutMs: 20_000,
          })
          .catch(() => undefined),
    }
    door = Door.create(api, {
      id: () => $.session.id(),
      fetch: (url, init) => $.http.fetch(url, init),
      rest: async ms => void (await $.process.run(['sleep', String(ms / 1000)], { timeoutMs: 2 * ms })),
    })
    await $.command.register({
      name: 'sidecar',
      description: 'The sidecar CLI: bare opens the sidecar on this conversation, starting it when it is down',
      argumentHint: '[open|comments|task|status|start|stop|restart|setup|uninstall|import|help]',
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
    void tellCommands($, api).catch(() => undefined)
    return next(e)
  })

  // A delivery from the sidecar lands as Marco's own words, or runs here as Stop, a model or a Review button Claude never sees.
  on('session.receive', async ($, e, next) => {
    const body = Relay.unwrap(e.text)
    if (!body) return next(e)
    const control = Control.parse(body)
    if (control?.do === 'stop') {
      await stopTurn($)
      return { consumed: 'sidecar stop' }
    }
    if (control?.do === 'model') {
      void $.command.run({ command: 'model', args: control.model }).catch(() => $.ui.toast(`The sidecar could not switch to ${control.model}`))
      return { consumed: 'sidecar model' }
    }
    if (control?.do === 'command') {
      const { name, args } = control
      if (Commands.needsTerminal(name, args)) $.ui.toast(`Run /${name} in your terminal`)
      else
        void $.command
          .run({ command: name, args })
          .catch(async error => {
            for (const text of Commands.notRun(name, args, error)) {
              await $.session.append({ message: { type: 'system', content: [{ type: 'text', text }] } })
            }
          })
          .catch(() => $.ui.toast(`The sidecar could not run /${name}`))
      return { consumed: 'sidecar command' }
    }
    if (control?.do === 'commands') {
      await tellCommands($, api)
      return { consumed: 'sidecar commands' }
    }
    if (await receiveReview({ text: body, sessionId: () => $.session.id() })) return { consumed: 'sidecar review action' }
    await update($, relayed, list => [...list, body])
    void $.session
      .id()
      .then(id =>
        $.http.fetch(`${api}/api/sessions/${id.slice(0, 8)}/landed`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: body }),
        }),
      )
      .catch(() => undefined)
    return next({ ...e, text: body })
  })

  // Claude Code frames the delivery as another session's only when it stores the row, after session.receive.
  on('session.append', { door: 'prompt', origin: { kind: 'peer' } }, async ($, e, next) => {
    const [block, ...rest] = e.message.content
    const text = block?.type === 'text' && !rest.length ? block.text : undefined
    const body = typeof text === 'string' ? Relay.unframe(text) : undefined
    if (!body || !(await read($, relayed)).includes(body)) return next(e)
    await update($, relayed, list => list.filter((one, at) => at !== list.indexOf(body)))
    return next({ ...e, message: { ...e.message, content: [{ type: 'text', text: body }] } })
  })

  // Only what Marco typed at this prompt, since a relayed message reads the same and may be another lead's.
  on('prompt.submit', async ($, e, next) => {
    const own = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    if (sidecar && own && !e.command && !e.isMeta && e.text.trim()) {
      const { hear } = sidecar
      void $.session.id().then(id => hear('message', e.text, id))
    }
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    rule ??= (await $.fs.read(`${$.plugin.root}/rules/sidecar.md`).catch(() => ''))
      .trim()
      .replaceAll('{{cli}}', `${$.plugin.root}/bin/sidecar`)
    if (!rule) return composed
    return { sections: [...composed.sections, { id: 'sidecar:rule', text: rule, scope: 'session' }] }
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    if (!e.tool_use_id || !door) return next(e)
    const opened = await door.open({ ref: e.tool_use_id, questions: e.questions, signal: next.signal })
    const raced = await Question.race(next(e), opened.port)
    opened.close()
    if (raced.from === 'dialog') return raced.result
    if (raced.from === 'gone') return { deny: 'The question was dismissed.' }
    return { result: { questions: e.questions, answers: raced.answers } }
  })

  // The engine runs this beside the terminal's dialog and ignores it once the dialog is answered, so it only waits.
  on('classic.PermissionRequest', async ($, e, next) => {
    if (!door || OWN_FLOW.has(e.tool_name)) return next(e)
    const beneath = await next(e)
    if (beneath.decision) return beneath
    const answered = new AbortController()
    next.signal.addEventListener('abort', () => answered.abort(), { once: true })
    const forget = Permission.wait(e, () => answered.abort())
    const opened = await door.open({
      ref: `permission-${crypto.randomUUID()}`,
      questions: [Permission.askOf(e)],
      signal: answered.signal,
    })
    const answers = await Question.hear(opened.port)
    opened.close()
    forget()
    return answers ? { decision: Permission.decide(e, answers) } : beneath
  })

  on('classic.PostToolUse', async ($, e, next) => {
    Permission.ran(e)
    return next(e)
  })

  on('classic.PostToolUseFailure', async ($, e, next) => {
    Permission.ran(e)
    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    Permission.turnEnded()
    return next(e)
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
