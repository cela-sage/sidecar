import type { NotebookEvent } from "~~/shared/types/notebook";
import { Notebooks } from "~~/server/utils/notebooks";

export default defineEventHandler(async (event): Promise<void> => {
  const path = await Notebooks.pathOf(event);
  const stream = createEventStream(event);
  const push = (one: NotebookEvent): void => void stream.push({ data: JSON.stringify(one), event: one.type });
  for (const one of await Notebooks.runs.snapshot(path)) push(one);
  stream.onClosed(Notebooks.runs.on(path, push));
  return stream.send();
});
