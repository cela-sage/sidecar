export interface Mention {
  start: number;
  end: number;
  title: string;
  key: string;
}

export interface Mentioned {
  title: string;
  key: string;
}

export interface Typed {
  text: string;
  caret: number;
}

export interface Picking {
  query: string;
}

const MENTION = /@(\[[^\]\n]+\][^@()\n]*?) \(([0-9a-f]{8})\)/g;
const TYPING = /(?:^|\s)@([^\s@]*)$/;

const of = (text: string): Mention[] =>
  [...text.matchAll(MENTION)].map((hit) => ({
    start: hit.index,
    end: hit.index + hit[0].length,
    title: hit[1] ?? "",
    key: hit[2] ?? "",
  }));

const typing = ({ text, caret }: Typed): Picking | undefined => {
  const hit = TYPING.exec(text.slice(0, caret));
  return hit ? { query: hit[1] ?? "" } : undefined;
};

const insert = ({ text, caret }: Typed, { title, key }: Mentioned): Typed => {
  const before = text.slice(0, caret).replace(/@[^\s@]*$/, "");
  const token = `@${title} (${key}) `;
  return { text: `${before}${token}${text.slice(caret)}`, caret: before.length + token.length };
};

export const Mentions = { insert, of, typing };
