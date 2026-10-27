import { Desk } from "~~/server/utils/desk";
import { TaskFiles } from "~~/server/utils/tasks/file";
import type { DeskTriage } from "~~/shared/types/desk";

export default defineEventHandler(async (): Promise<DeskTriage> => {
  const files = TaskFiles.all();
  const inbox = files.filter((file) => file.task.state === "unassigned");
  const routes = await Desk.routes(inbox).catch((error: unknown) => {
    console.error(`sidecar: no route suggestions: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  });
  return { asks: Desk.asks(files), routes };
});
