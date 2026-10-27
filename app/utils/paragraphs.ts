export interface Paragraph {
  first: number;
  last: number;
  text: string;
}

const HEADING = /^#{1,6}[ \t]+(.+?)[ \t#]*$/;

const isBlank = (line: string | undefined): boolean => !line?.trim();

// Lines are 1-based like Monaco's, and a paragraph is a run of non-blank lines, the block the server's edit finds.
function touched({ lines, from, to }: { lines: string[]; from: number; to: number }): Paragraph[] {
  const found: Paragraph[] = [];
  let at = from;
  while (at <= to) {
    if (isBlank(lines[at - 1])) {
      at += 1;
      continue;
    }
    let first = at;
    while (first > 1 && !isBlank(lines[first - 2])) first -= 1;
    let last = at;
    while (last < lines.length && !isBlank(lines[last])) last += 1;
    found.push({ first, last, text: lines.slice(first - 1, last).join("\n") });
    at = last + 1;
  }
  return found;
}

function sectionOf(lines: string[], line: number): string | undefined {
  for (let at = line; at >= 1; at -= 1) {
    const heading = HEADING.exec(lines[at - 1] ?? "")?.[1];
    if (heading) return heading;
  }
  return undefined;
}

const wordsIn = (text: string): number => text.split(/\s+/).filter(Boolean).length;

export const Paragraphs = { sectionOf, touched, wordsIn };
