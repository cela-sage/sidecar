export type ControlAction =
  | { do: 'stop' }
  | { do: 'commands' }
  | { do: 'model'; model: string }
  | { do: 'command'; name: string; args: string }

const MODEL = /^[a-z0-9][a-z0-9.\-[\]]{1,63}$/
const COMMAND = /^[A-Za-z0-9][\w:.-]{0,63}$/

const isAction = (value: unknown): value is ControlAction => {
  if (typeof value !== 'object' || !value || !('do' in value)) return false
  if (value.do === 'stop' || value.do === 'commands') return Object.keys(value).length === 1
  if (value.do === 'model') return 'model' in value && typeof value.model === 'string' && MODEL.test(value.model)
  return (
    value.do === 'command' &&
    'name' in value &&
    typeof value.name === 'string' &&
    COMMAND.test(value.name) &&
    'args' in value &&
    typeof value.args === 'string'
  )
}

export const Control = {
  // The whole body under [[sidecar]] has to be the action, so a message that quotes one is never run.
  parse(body: string): ControlAction | undefined {
    const json = body.trim()
    if (!json.startsWith('{')) return undefined
    try {
      const value: unknown = JSON.parse(json)
      return isAction(value) ? value : undefined
    } catch {
      return undefined
    }
  },
}
