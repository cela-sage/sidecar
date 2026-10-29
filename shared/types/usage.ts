export interface RateLimit {
  kind: string;
  percentUsed: number;
  resetsAt?: string;
}

export interface ContextFigures {
  window: number;
  tokens?: number;
  percent?: number;
}

export interface ContextPart {
  label: string;
  tokens: number;
}

export interface ContextBreakdown {
  model: string;
  parts: ContextPart[];
  autoCompactPercent?: number;
}

export interface SessionUsage {
  context: ContextFigures;
  rateLimits: RateLimit[];
  isCompacting?: true;
  breakdown?: ContextBreakdown;
}
