import { conversationOf } from "~~/server/utils/sessions/conversation";
import { transcriptIndex, transcripts } from "~~/server/utils/sessions/transcripts";

export default defineNitroPlugin(() => {
  const offsets = new Map([...transcriptIndex()].map(([key, { size }]) => [key, size]));
  transcripts.on("grew", ({ key, path }) => {
    const slice = conversationOf({ key, path, since: offsets.get(key) ?? 0 });
    offsets.set(key, slice.offset);
    if (slice.turns.length) transcripts.emit("turned", { key, path, ...slice });
  });
});
