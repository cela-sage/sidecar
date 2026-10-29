import z from "zod";
import { splitLines } from "../../../lib/text.ts";
import { PastedImages } from "../../../shared/utils/pasted-images.ts";
import { readRange, transcriptIndex } from "./transcripts.ts";

const Block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image"), source: z.object({ media_type: z.string(), data: z.string() }) }),
]);

const Entry = z.object({ type: z.literal("user"), message: z.object({ content: z.array(z.unknown()) }) });

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

const entryOf = (line: string): z.infer<typeof Entry> | undefined => {
  try {
    return Entry.safeParse(JSON.parse(line)).data;
  } catch {
    return undefined;
  }
};

// The picture and its source line are separate messages, so the Nth source line takes the Nth image block waiting.
const namedIn = (text: string): Named[] => {
  const waiting: { type: string; data: string }[] = [];
  const named: Named[] = [];
  for (const line of splitLines(text)) {
    if (!line.includes('"type":"image"') && !line.includes("[Image: source:")) continue;
    for (const raw of entryOf(line)?.message.content ?? []) {
      const block = Block.safeParse(raw).data;
      if (block?.type === "image") waiting.push({ type: block.source.media_type, data: block.source.data });
      if (block?.type !== "text") continue;
      for (const path of PastedImages.sourcesOf(block.text)) named.push({ path, ...waiting.shift() });
    }
  }
  return named;
};

// Only a path the conversation was handed as a pasted image, never an arbitrary file the page names.
const find = ({ key, path }: { key: string; path: string }): SentImage | undefined => {
  const transcript = transcriptIndex().get(key)?.path;
  const text = transcript && readRange(transcript, 0, Number.POSITIVE_INFINITY)?.text;
  const hit = text ? namedIn(text).find((one) => one.path === path) : undefined;
  return hit && { path, type: hit.type, bytes: hit.data ? Buffer.from(hit.data, "base64") : undefined };
};

export const SentImages = { find };
