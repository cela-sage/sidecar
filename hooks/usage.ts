import type { SessionContextBreakdown, SessionUsage } from 'claude-code'

export interface UsageReport {
  context: { window: number; tokens?: number; percent?: number }
  rateLimits: SessionUsage['rateLimits']
  breakdown?: {
    model: string
    tokens: number
    window: number
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
  // A window no response has measured yet, fresh or just compacted, is read from the breakdown's own estimate.
  describe: ({ context, rateLimits }: SessionUsage): UsageReport => {
    const { breakdown } = context
    return {
      context: {
        window: context.window,
        tokens: context.tokens ?? breakdown?.totalTokens,
        percent: context.percent ?? breakdown?.percentage,
      },
      rateLimits,
      ...(breakdown
        ? {
            breakdown: {
              model: breakdown.model,
              tokens: breakdown.totalTokens,
              window: breakdown.rawMaxTokens,
              parts: partsOf(breakdown),
              ...(breakdown.autoCompactThreshold
                ? { autoCompactPercent: Math.round((breakdown.autoCompactThreshold / breakdown.rawMaxTokens) * 100) }
                : {}),
            },
          }
        : {}),
    }
  },
}
