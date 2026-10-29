import { homedir } from "node:os";
import { conversationOf, type ConversationTurn } from "./conversation.ts";

interface Said {
  offset: number;
  text: string;
}

const KEPT_MAX = 8;
const BEFORE = /[\w.~/-]/;
const AFTER = /^(?:[\w/-]|\.\w)/;

const kept = new Map<string, Said>();

const isSaid = ({ role, kind }: ConversationTurn): boolean =>
  (role === "user" || role === "assistant") && kind !== "acting" && kind !== "thinking";

// Reads only what the transcript gained since the last ask, so a reply full of paths costs one read and not one each.
const saidIn = (key: string): string => {
  let known = kept.get(key) ?? { offset: 0, text: "" };
  let grown = conversationOf({ key, since: known.offset });
  if (grown.offset < known.offset) {
    known = { offset: 0, text: "" };
    grown = conversationOf({ key });
  }
  const said = grown.turns.filter(isSaid).map((turn) => turn.text);
  const next = { offset: grown.offset, text: [known.text, ...said].join("\n") };
  kept.delete(key);
  kept.set(key, next);
  const [oldest] = kept.keys();
  if (oldest && kept.size > KEPT_MAX) kept.delete(oldest);
  return next.text;
};

// A longer path or a file of the same name with a suffix must not name this one, while a sentence's full stop may follow it.
const isNamed = (text: string, path: string): boolean => {
  for (let at = text.indexOf(path); at >= 0; at = text.indexOf(path, at + 1)) {
    const end = at + path.length;
    if (!BEFORE.test(text[at - 1] ?? "") && !AFTER.test(text.slice(end, end + 2))) return true;
  }
  return false;
};

const tildeOf = (path: string): string => {
  const home = homedir();
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
};

// Whatever the chat shows is what its preview may read, so a path in a reply or a message is readable and no other is.
const has = ({ key, path }: { key: string; path: string }): boolean => {
  const text = saidIn(key);
  return isNamed(text, path) || isNamed(text, tildeOf(path));
};

export const Mentioned = { has };
