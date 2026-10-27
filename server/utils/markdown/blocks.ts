export interface Block {
  from: number;
  text: string;
  to: number;
}

type Range = [from: number, to: number];

const FENCE = /^(```|~~~)[\s\S]*?^\1/gm;

const fences = (text: string): Range[] =>
  [...text.matchAll(FENCE)].map((hit) => [hit.index, hit.index + hit[0].length]);

const within = (ranges: Range[], at: number): boolean => ranges.some(([from, to]) => at >= from && at < to);

// A fence stays one block however many blank lines it holds, so a paragraph is never cut out of the middle of code.
const of = (text: string): Block[] => {
  const fenced = fences(text);
  const spans: Range[] = [];
  let open: Range | undefined;
  let at = 0;
  for (const line of text.split("\n")) {
    const end = at + line.replace(/\r$/, "").length;
    if (!line.trim() && !within(fenced, at)) open = undefined;
    else if (open) open[1] = end;
    else spans.push((open = [at, end]));
    at += line.length + 1;
  }
  return spans.map(([from, to]) => ({ from, to, text: text.slice(from, to) }));
};

export const Blocks = { fences, of, within };
