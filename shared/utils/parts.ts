export interface Part {
  name: string;
  lead: string;
  body: string;
}

const H2 = /^##[ \t]+(.+?)[ \t#]*$/;
const COMMENTS = /<!--[\s\S]*?-->/g;
const MARKS = /\*\*|__|[*_`]/g;
const LINK = /!?\[([^\]]*)\]\([^)]*\)/g;

const leadOf = (body: string): string => {
  const [line = ""] = body
    .split("\n")
    .map((one) => one.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "").trim())
    .filter((one) => one && !one.startsWith("|") && !one.startsWith("```") && !one.startsWith("<"));
  const plain = line.replace(LINK, "$1").replace(MARKS, "");
  const end = plain.search(/[.!?](\s|$)/);
  return end < 0 ? plain : plain.slice(0, end + 1);
};

const of = (markdown: string): Part[] => {
  const parts: { name: string; lines: string[] }[] = [];
  for (const line of markdown.replace(COMMENTS, "").split("\n")) {
    const name = H2.exec(line)?.[1];
    if (name) parts.push({ name, lines: [] });
    else parts.at(-1)?.lines.push(line);
  }
  return parts.map(({ name, lines }) => {
    const body = lines.join("\n").trim();
    return { name, lead: leadOf(body), body };
  });
};

const changed = (before: string, after: string): string[] => {
  const was = new Map(of(before).map((part) => [part.name, part.body]));
  const now = of(after);
  const edited = now.filter((part) => was.get(part.name) !== part.body).map((part) => part.name);
  const gone = [...was.keys()].filter((name) => !now.some((part) => part.name === name));
  return [...edited, ...gone];
};

export const Parts = { changed, of };
