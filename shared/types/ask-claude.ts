export interface AskClaudeExchange {
  question: string;
  response: string;
}

export interface AskClaudeRequest {
  question: string;
  history: AskClaudeExchange[];
  path?: string;
}

export type AskClaudeReply = { answered: true; answer: string } | { answered: false; message: string };
