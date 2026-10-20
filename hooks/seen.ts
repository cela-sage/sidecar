import type { Port } from './review/port'

const mark = async (port: Port, sessionId: string): Promise<void> => {
  const marker = `${await port.home()}/.claude/sidecar/conversations/${sessionId.slice(0, 8)}`
  if (!(await port.exists(marker))) await port.write(marker, '')
}

export const Seen = { mark }
