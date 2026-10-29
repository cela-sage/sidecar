export type ImagePart = { kind: "text"; text: string } | { kind: "image"; number: number };

const SOURCE = /\[Image: source: ([^\]\n]+)\]/g;
const MARKER = /\[Image #(\d+)\]/g;
const FILE_NUMBER = /\/(\d+)\.[^/.]+$/;

// A message of several images reaches us with its source lines joined, so the lines can be glued or separated.
const sourcesOf = (text: string): string[] => {
  const paths = [...text.matchAll(SOURCE)].map((hit) => hit[1] ?? "");
  return paths.length && !text.replace(SOURCE, "").trim() ? paths : [];
};

// Claude Code saves the Nth pasted image of a session as `<N>.<extension>`, and that is the only link from `[Image #N]` to its file.
const numberOf = (path: string): number | undefined => {
  const hit = FILE_NUMBER.exec(path);
  return hit ? Number(hit[1]) : undefined;
};

const partsOf = (text: string): ImagePart[] => {
  const parts: ImagePart[] = [];
  let at = 0;
  for (const hit of text.matchAll(MARKER)) {
    if (hit.index > at) parts.push({ kind: "text", text: text.slice(at, hit.index) });
    parts.push({ kind: "image", number: Number(hit[1]) });
    at = hit.index + hit[0].length;
  }
  if (at < text.length) parts.push({ kind: "text", text: text.slice(at) });
  return parts;
};

export const PastedImages = { numberOf, partsOf, sourcesOf };
