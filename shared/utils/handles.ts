export interface Handle {
  start: number;
  end: number;
  word: string;
}

const HANDLE = /(?<![\p{L}\p{N}_@./-])@([\p{L}\p{N}_-]+)/gu;
const CODE = /```[\s\S]*?```|`[^`\n]*`/g;

// Backticks keep a mention as the word itself, the way Slack leaves code alone, and blanking keeps every offset.
const of = (text: string): Handle[] =>
  [...text.replace(CODE, (code) => " ".repeat(code.length)).matchAll(HANDLE)].map((hit) => ({
    start: hit.index,
    end: hit.index + hit[0].length,
    word: hit[1] ?? "",
  }));

export const Handles = { of };
