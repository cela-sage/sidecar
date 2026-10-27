import { createError } from "h3";
import type { FileSave } from "../../../shared/types/files.ts";
import { readArtifact, writeArtifact, type ArtifactSource } from "../artifacts.ts";
import { hashOf, refusalOf } from "../sessions/files.ts";

const markdown = async (slug: string): Promise<ArtifactSource> => {
  const source = await readArtifact(slug);
  if (!source || source.kind === "web")
    throw createError({ statusCode: 404, statusMessage: `no artifact matching '${slug}'` });
  if (source.format !== "md")
    throw createError({ statusCode: 409, statusMessage: `'${slug}' is not a markdown artifact` });
  return source;
};

const save = async ({ base, path, text }: { base: string; path: string; text: string }): Promise<FileSave> => {
  const refusal = refusalOf({ base, path });
  if (refusal) return refusal;
  await writeArtifact({ path, text });
  return { saved: true, hash: hashOf(text) };
};

export const MarkdownSource = { markdown, save };
