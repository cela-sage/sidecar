import { Terminal } from "~~/server/utils/terminal";

export default defineEventHandler((event): Promise<void> => {
  const stream = createEventStream(event);
  stream.onClosed(Terminal.join(stream));
  void stream.push({ event: "ready", data: JSON.stringify(Terminal.state()) });
  return stream.send();
});
