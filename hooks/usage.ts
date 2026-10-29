import type { SessionContextBreakdown, SessionUsage } from 'claude-code'

export interface UsageReport {
  context: { window: number; tokens?: number; percent?: number }
  rateLimits: SessionUsage['rateLimits']
  isCompacting?: true
  breakdown?: {
    model: string
    parts: { label: string; tokens: number }[]
    autoCompactPercent?: number
  }
}

// /context lists a dozen rows, so the popover folds the ones that load alike under one label, in the order it draws them.
const ORDER = ['Messages', 'Memory files', 'Tools', 'System']
const FOLDED: Record<string, string> = {
  Messages: 'Messages',
  'Memory files': 'Memory files',
  'System tools': 'Tools',
  'MCP tools': 'Tools',
  'Custom agents': 'Tools',
}

const partsOf = ({ categories }: SessionContextBreakdown): { label: string; tokens: number }[] => {
  const totals = new Map(ORDER.map(label => [label, 0]))
  for (const { kind, name, tokens } of categories) {
    if (kind !== 'used') continue
    const label = FOLDED[name] ?? 'System'
    totals.set(label, (totals.get(label) ?? 0) + tokens)
  }
  return [...totals].map(([label, tokens]) => ({ label, tokens })).filter(part => part.tokens > 0)
}

// A compaction counts only the messages it kept, so what stays outside them is added back, and the breakdown, taken before the swap, is left out.
const fixedOf = ({ categories }: SessionContextBreakdown): number =>
  categories
    .filter(({ kind, name }) => kind === 'used' && name !== 'Messages')
    .reduce((sum, { tokens }) => sum + tokens, 0)

export const Usage = {
  // No response yet means the size comes from the breakdown, which counts the compaction window, so shares are restated on the model's window.
  describe: (
    { context, rateLimits }: SessionUsage,
    { compactedTo, isCompacting }: { compactedTo?: number; isCompacting?: boolean } = {},
  ): UsageReport => {
    const { breakdown, window } = context
    const tokens =
      compactedTo && breakdown ? compactedTo + fixedOf(breakdown) : (context.tokens ?? breakdown?.totalTokens)
    return {
      context: { window, tokens, percent: tokens ? Math.round((tokens / window) * 100) : undefined },
      rateLimits,
      ...(isCompacting ? { isCompacting } : {}),
      ...(breakdown && !compactedTo
        ? {
            breakdown: {
              model: breakdown.model,
              parts: partsOf(breakdown),
              ...(breakdown.autoCompactThreshold
                ? { autoCompactPercent: Math.round((breakdown.autoCompactThreshold / window) * 100) }
                : {}),
            },
          }
        : {}),
    }
  },
}
