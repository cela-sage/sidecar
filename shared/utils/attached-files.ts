import { FileKind } from "./file-kind.ts";

const LINE = /^Attached: (\/.+)$/;

const line = (path: string): string => `Attached: ${path}`;

// The sidecar appends its files as the last lines of a message, so only that trailing run is read back, never a quote.
const imagesOf = (text: string): { text: string; paths: string[] } => {
  const lines = text.trimEnd().split("\n");
  let start = lines.length;
  while (start > 0 && LINE.test(lines[start - 1] ?? "")) start--;
  const kept = lines.slice(0, start);
  const paths: string[] = [];
  for (const one of lines.slice(start)) {
    const path = LINE.exec(one)?.[1] ?? "";
    if (FileKind.of(path) === "image") paths.push(path);
    else kept.push(one);
  }
  return { text: kept.join("\n").trimEnd(), paths };
};

export const AttachedFiles = { imagesOf, line };
