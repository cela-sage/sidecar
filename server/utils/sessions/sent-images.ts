import { resolve, sep } from "node:path";
import z from "zod";
import { Sidecar } from "../../../lib/sidecar/paths.ts";
import { splitLines } from "../../../lib/text.ts";
import { AttachedFiles } from "../../../shared/utils/attached-files.ts";
import { PastedImages } from "../../../shared/utils/pasted-images.ts";
import { plain } from "./relay.ts";
import { readRange, transcriptIndex } from "./transcripts.ts";

const Block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image"), source: z.object({ media_type: z.string(), data: z.string() }) }),
]);

const Entry = z.object({
  type: z.literal("user"),
  message: z.object({ content: z.union([z.string(), z.array(z.unknown())]) }),
});

interface Named {
  path: string;
  type?: string;
  data?: string;
}

export interface SentImage {
  path: string;
  type?: string;
  bytes?: Buffer;
}

const blocksOf = (line: string): unknown[] => {
  try {
    const content = Entry.safeParse(JSON.parse(line)).data?.message.content ?? [];
    return typeof content === "string" ? [{ type: "text", text: content }] : content;
  } catch {
    return [];
  }
};

// What the prompt saved is the only file a line of text may name, so a message cannot make any other readable.
const isUpload = (path: string): boolean => resolve(path) === path && path.startsWith(`${Sidecar.uploads()}${sep}`);

// The picture and its source line are separate messages, so the Nth source line takes the Nth image block waiting.
const namedIn = (text: string): Named[] => {
  const waiting: { type: string; data: string }[] = [];
  const named: Named[] = [];
  for (const line of splitLines(text)) {
    const isSent = line.includes("[Image: source:") || line.includes("Attached: ");
    if (!isSent && !line.includes('"type":"image"')) continue;
    for (const raw of blocksOf(line)) {
      const block = Block.safeParse(raw).data;
      if (block?.type === "image") waiting.push({ type: block.source.media_type, data: block.source.data });
      if (block?.type !== "text") continue;
      const said = plain(block.text);
      for (const path of PastedImages.sourcesOf(said)) named.push({ path, ...waiting.shift() });
      for (const path of AttachedFiles.imagesOf(said).paths) if (isUpload(path)) named.push({ path });
    }
  }
  return named;
};

// Only a path a user message handed over, pasted or saved by the prompt, never an arbitrary file the page names.
const find = ({ key, path }: { key: string; path: string }): SentImage | undefined => {
  const transcript = transcriptIndex().get(key)?.path;
  const text = transcript && readRange(transcript, 0, Number.POSITIVE_INFINITY)?.text;
  const hit = text ? namedIn(text).find((one) => one.path === path) : undefined;
  return hit && { path, type: hit.type, bytes: hit.data ? Buffer.from(hit.data, "base64") : undefined };
};

export const SentImages = { find };
