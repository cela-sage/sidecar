import { Blocks } from "./blocks.ts";

export interface Proposal {
  from: number;
  id: string;
  next: string;
  old: string;
  to: number;
}

const SHAPE =
  /(?<![^\n])<del data-sc-edit="([0-9a-f]{12})">\n\n([\s\S]*?)\n\n<\/del>\n<ins data-sc-edit="\1">\n\n([\s\S]*?)\n\n<\/ins>(?![^\n])/g;

const find = (text: string): Proposal[] => {
  const fenced = Blocks.fences(text);
  return [...text.matchAll(SHAPE)]
    .filter((hit) => !Blocks.within(fenced, hit.index))
    .map((hit) => {
      const [whole, id = "", old = "", next = ""] = hit;
      return { from: hit.index, id, next, old, to: hit.index + whole.length };
    });
};

const format = ({ id, next, old }: Pick<Proposal, "id" | "next" | "old">): string =>
  `<del data-sc-edit="${id}">\n\n${old}\n\n</del>\n<ins data-sc-edit="${id}">\n\n${next}\n\n</ins>`;

const mint = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const token = (id: string): string => `sidecar-proposal-${id}`;

// comark drops a block tag's closing partner, so each proposal is parsed as a paragraph of its own and drawn back after.
const hold = (text: string): { held: Map<string, Proposal>; text: string } => {
  const found = find(text);
  let out = text;
  for (const one of found.toReversed()) out = `${out.slice(0, one.from)}\n\n${token(one.id)}\n\n${out.slice(one.to)}`;
  return { held: new Map(found.map((one) => [token(one.id), one])), text: out };
};

export const Proposals = { find, format, hold, mint };
