import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import z from "zod";
import { withoutReminders } from "./speaker.ts";
import { transcriptIndex } from "./transcripts.ts";

const Row = z.object({
  isCompactSummary: z.literal(true),
  timestamp: z.string().transform((stamp) => Date.parse(stamp)),
  message: z.object({
    content: z.union([z.string(), z.array(z.object({ text: z.string().optional() }))]),
  }),
});

const Boundary = z.object({
  subtype: z.literal("compact_boundary"),
  compactMetadata: z.object({ preTokens: z.number(), postTokens: z.number() }),
});

export interface CompactSizes {
  before: number;
  after: number;
}

const rowOf = (line: string): z.infer<typeof Row> | undefined => {
  try {
    return Row.safeParse(JSON.parse(line)).data;
  } catch {
    return undefined;
  }
};

export const sizesOf = (line: string): CompactSizes | undefined => {
  if (!line.includes('"compact_boundary"')) return undefined;
  try {
    const row = Boundary.safeParse(JSON.parse(line)).data;
    return row && { before: row.compactMetadata.preTokens, after: row.compactMetadata.postTokens };
  } catch {
    return undefined;
  }
};

// A transcript runs to hundreds of megabytes, so it is streamed and only the lines that name a summary are parsed.
export const summaryOf = async ({ key, at }: { key: string; at: number }): Promise<string | undefined> => {
  const path = transcriptIndex().get(key)?.path;
  if (!path) return undefined;
  const input = createReadStream(path);
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      if (!line.includes('"isCompactSummary":true')) continue;
      const row = rowOf(line);
      if (row?.timestamp !== at) continue;
      const { content } = row.message;
      return withoutReminders(typeof content === "string" ? content : content.map((part) => part.text ?? "").join(""));
    }
    return undefined;
  } finally {
    input.destroy();
  }
};
