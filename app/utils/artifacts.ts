import type { ArtifactMeta } from "~~/shared/types/artifact";
import type { LiveSession } from "~~/shared/types/session";

export interface ListedOptions {
  catalogue: ArtifactMeta[];
  session?: LiveSession;
}

// A scratch .md the conversation wrote is a document, so it stays in Files with the rest of its files.
const listedBy = ({ catalogue, session }: ListedOptions): ArtifactMeta[] => {
  const mine = new Set(session?.artifacts ?? []);
  return catalogue.filter((meta) => mine.has(meta.slug) && meta.kind !== "document");
};

export const Artifacts = { listedBy };
