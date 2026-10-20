// cc-sidecar and mode-relay v1 are what the sidecar sent before, and a queued delivery can still carry them.
const MARKER = /^\[\[(?:sidecar|cc-sidecar|mode-relay v1)(?: slug=[A-Za-z0-9._-]+)?\]\]\n?/
// Claude Code puts these around a peer delivery when it stores the row, after session.receive has run.
const FRAME_HEAD = /^Another Claude session sent a message:\s*/
const FRAME_NOTE = '\n\nThis came from another Claude session'

export const Relay = {
  /** Marco's own words when this is a delivery from the sidecar, with the marker gone. */
  unwrap(text: string): string | undefined {
    const body = text.trim()
    return MARKER.test(body) ? body.replace(MARKER, '').trim() : undefined
  },

  unframe(row: string): string | undefined {
    if (!FRAME_HEAD.test(row)) return undefined
    const inner = row.replace(FRAME_HEAD, '')
    // The harness appends its note last, so an earlier copy is one Marco quoted.
    const cut = inner.lastIndexOf(FRAME_NOTE)
    return (cut < 0 ? inner : inner.slice(0, cut)).trim()
  },
}
