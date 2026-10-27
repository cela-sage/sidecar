import { Terminal } from "~~/server/utils/terminal";

export default defineEventHandler((event): Promise<void> => {
  const stream = createEventStream(event);
  stream.onClosed(Terminal.join(stream));
  return stream.send();
});
