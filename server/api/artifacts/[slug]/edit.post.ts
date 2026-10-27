import z from "zod";
import { readArtifact, writeArtifact } from "~~/server/utils/artifacts";
import { Edits } from "~~/server/utils/edits";
import type { ArtifactEditReply } from "~~/shared/types/artifact";

const Body = z.object({
  action: z.enum(["accept", "apply", "revert"]).default("apply"),
  id: z.string().default(""),
  path: z.string().default(""),
  replacement: z.string().default(""),
  selection: z.string().default(""),
});

export default defineEventHandler(async (event): Promise<ArtifactEditReply> => {
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, statusMessage: "missing slug" });

  const body = await readValidatedBody(event, (raw) => Body.parse(raw));

  const source = await readArtifact(slug);
  if (!source || source.kind === "web")
    throw createError({ statusCode: 404, statusMessage: `no artifact matching '${slug}'` });
  const { format } = source;
  if (format !== "html" && format !== "md")
    throw createError({ statusCode: 409, statusMessage: "Only pages and markdown take inline edits" });

  const outcome = Edits.run(format, { ...body, text: source.text });
  if (!outcome.ok) {
    throw createError({
      statusCode: outcome.reason === "invalid" ? 400 : 409,
      statusMessage: Edits.failure(format, outcome.reason),
    });
  }

  await writeArtifact({ path: source.path, text: outcome.text });
  return { id: outcome.id };
});
