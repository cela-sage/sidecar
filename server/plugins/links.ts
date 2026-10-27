import { existsSync } from "node:fs";
import { Links } from "~~/server/utils/sessions/links";
import { transcriptIndex, transcripts } from "~~/server/utils/sessions/transcripts";

export default defineNitroPlugin(() => {
  const before = new Map<string, number>();
  for (const [key, { path, size }] of transcriptIndex()) {
    if (existsSync(Links.ledger(key))) Links.catchUp({ key, path });
    else before.set(key, size);
  }

  transcripts.on("turned", (grown) => {
    if (before.has(grown.key)) {
      Links.catchUp({ key: grown.key, path: grown.path, until: before.get(grown.key) });
      before.delete(grown.key);
    }
    Links.adopt({ ...grown, isLive: true });
  });
});
