import type { AttachedFile } from "~~/shared/types/files";
import type { Typed } from "./mentions.ts";

export interface Attachment extends AttachedFile {
  preview?: string;
}

export interface FileToken {
  start: number;
  end: number;
  name: string;
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A saved name has no space, bracket or parenthesis, so `@name` can never read as a conversation pick.
const of = (text: string, files: AttachedFile[]): FileToken[] => {
  if (!files.length) return [];
  const names = files.map((one) => escape(one.name)).join("|");
  return [...text.matchAll(new RegExp(`(?<=^|\\s)@(${names})(?=\\s|$)`, "g"))].map((hit) => ({
    start: hit.index,
    end: hit.index + hit[0].length,
    name: hit[1] ?? "",
  }));
};

const insert = ({ text, caret }: Typed, name: string): Typed => {
  const before = text.slice(0, caret);
  const token = `${before && !/\s$/.test(before) ? " " : ""}@${name} `;
  return { text: `${before}${token}${text.slice(caret)}`, caret: before.length + token.length };
};

const message = (text: string, files: AttachedFile[]): string => {
  const named = new Set(of(text, files).map((one) => one.name));
  const lines = files.filter((one) => named.has(one.name)).map((one) => `Attached: ${one.path}`);
  return lines.length ? `${text}\n\n${lines.join("\n")}` : text;
};

const drop = (text: string, file: AttachedFile): string => {
  let rest = text;
  const tokens = of(text, [file]).reverse();
  for (const { start, end } of tokens) rest = `${rest.slice(0, start)}${rest.slice(end).replace(/^\s/, "")}`;
  return rest;
};

const previewOf = (file: File): string | undefined =>
  file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;

const release = (files: Attachment[]): void => {
  for (const { preview } of files) if (preview) URL.revokeObjectURL(preview);
};

export const Attachments = { drop, insert, message, of, previewOf, release };
