import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

interface Move {
  was: string;
  now: string;
}

interface Changes {
  stamps: string[];
  lines: Map<string, number>;
  hidden: boolean;
}

const OLD = "done";
const NEW = "archived";
const BLOCK = /<!--\s*artifact\b[\s\S]*?-->/;
const STATE = /^(state:[ \t]+)done[ \t]*$/m;

const { values } = parseArgs({
  options: {
    home: { type: "string" },
    artifacts: { type: "string" },
    dry: { type: "boolean", default: false },
  },
});

const expand = (path: string): string => (path.startsWith("~/") ? join(homedir(), path.slice(2)) : path);
const home = expand(values.home ?? join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "sidecar"));
const artifacts = expand(values.artifacts ?? process.env.NOTES_ARTIFACTS ?? join(home, "artifacts"));
const trash = join(home, "trash");
const history = join(home, "history");

const listed = (dir: string, ext: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(ext)).map((name) => join(dir, name)) : [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && !!value && !Array.isArray(value);

const isMove = (value: unknown): value is Move =>
  isRecord(value) && typeof value.was === "string" && typeof value.now === "string";

const restamped = (text: string): string | undefined => {
  const block = BLOCK.exec(text)?.[0];
  if (!block || !STATE.test(block)) return undefined;
  return text.replace(block, () => block.replace(STATE, (_, key: string) => `${key}${NEW}`));
};

const relined = (line: string): string | undefined => {
  if (!line.includes(`"${OLD}"`)) return undefined;
  let entry: unknown;
  try {
    entry = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(entry)) return undefined;
  const { move } = entry;
  if (!isMove(move) || (move.was !== OLD && move.now !== OLD)) return undefined;
  const next = { was: move.was === OLD ? NEW : move.was, now: move.now === OLD ? NEW : move.now };
  return JSON.stringify({ ...entry, move: next });
};

const sweep = (): Changes => {
  const changes: Changes = { stamps: [], lines: new Map(), hidden: false };
  for (const path of [...listed(artifacts, ".md"), ...listed(trash, ".md")]) {
    const next = restamped(readFileSync(path, "utf8"));
    if (!next) continue;
    changes.stamps.push(path);
    if (!values.dry) writeFileSync(path, next);
  }
  for (const path of [...listed(history, ".jsonl"), ...listed(trash, ".jsonl")]) {
    let count = 0;
    const lines = readFileSync(path, "utf8")
      .split("\n")
      .map((line) => {
        const next = relined(line);
        if (next) count += 1;
        return next ?? line;
      });
    if (!count) continue;
    changes.lines.set(path, count);
    if (!values.dry) writeFileSync(path, lines.join("\n"));
  }
  const hidden = join(home, "tasks-hidden.json");
  if (existsSync(hidden)) {
    changes.hidden = true;
    if (!values.dry) rmSync(hidden);
  }
  return changes;
};

const changes = sweep();
const verb = values.dry ? "would rewrite" : "rewrote";
for (const path of changes.stamps) console.log(`stamp    ${path}`);
for (const [path, count] of changes.lines) console.log(`history  ${path}  ${count}`);
let total = 0;
for (const count of changes.lines.values()) total += count;
console.log(
  `${values.dry ? "dry run: " : ""}${verb} ${changes.stamps.length} stamps and ${total} history lines in ` +
    `${changes.lines.size} files, ${changes.hidden ? (values.dry ? "would delete" : "deleted") : "no"} tasks-hidden.json ` +
    `(home ${home}, artifacts ${artifacts})`,
);
