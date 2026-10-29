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

export const Usage = {
  // No response yet means the size comes from the breakdown, which counts the compaction window, so shares are restated on the model's window.
  describe: (
    { context, rateLimits }: SessionUsage,
    { tokens: known, isCompacting }: { tokens?: number; isCompacting?: boolean } = {},
  ): UsageReport => {
    const { breakdown, window } = context
    const tokens = known ?? context.tokens ?? breakdown?.totalTokens
    return {
      context: { window, tokens, percent: tokens ? Math.round((tokens / window) * 100) : undefined },
      rateLimits,
      ...(isCompacting ? { isCompacting } : {}),
      ...(breakdown
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
