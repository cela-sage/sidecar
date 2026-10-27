import { conversationOf, type ConversationGrowth, type ConversationTurn } from "~~/server/utils/sessions/conversation";
import { transcripts } from "~~/server/utils/sessions/transcripts";

export default defineEventHandler((event): Promise<void> => {
  const key = getRouterParam(event, "key") || "";
  const stream = createEventStream(event);
  const push = (turns: ConversationTurn[]): void => {
    for (const turn of turns) void stream.push({ event: "turn", data: JSON.stringify(turn) });
  };
  // Resuming from the client's offset closes the gap between its backfill and this connection, and the client drops a turn it already holds.
  const since = Number(getQuery(event).since);
  if (Number.isFinite(since) && since > 0) push(conversationOf({ key, since }).turns);

  const emit = (grown: ConversationGrowth): void => {
    if (grown.key === key) push(grown.turns);
  };
  transcripts.on("turned", emit);
  stream.onClosed(() => {
    transcripts.off("turned", emit);
  });

  return stream.send();
});
