import { stripVTControlCharacters } from "node:util";

const FAILING = /error|fail|panic|exception|✗|✘|×/i;
const MATCHED = 40;
const TAIL = 15;

// A line a progress bar redrew keeps only what was drawn last.
const shown = (line: string): string => stripVTControlCharacters(line.split("\r").at(-1) ?? "").trimEnd();

const failingLines = (output: string): string[] => {
  const lines = output.split(/\r?\n/).map(shown).filter(Boolean);
  const matched = lines.filter((line) => FAILING.test(line));
  return matched.length ? matched.slice(-MATCHED) : lines.slice(-TAIL);
};

export const RunOutput = { failingLines };
