import { Threads } from "../../../lib/sidecar/threads.ts";
import type { DeskAsk } from "../../../shared/types/desk.ts";
import type { TaskFile } from "../tasks/file.ts";
import { TaskLane } from "../tasks/lane.ts";
import { DeskHandoff } from "./handoff.ts";
import { DeskRoutes } from "./routes.ts";
import { DeskStandings } from "./standing.ts";

const asks = (files: TaskFile[]): DeskAsk[] =>
  files.flatMap((file) =>
    TaskLane.asksOf(Threads.read(file.path).threads)
      .filter((one) => one.status !== "resolved")
      .map((one) => ({
        slug: file.slug,
        title: file.title,
        ...(file.task.project ? { project: file.task.project } : {}),
        thread: String(one.id),
        kind: one.ask.kind,
        question: String(one.body ?? ""),
        ...(one.ask.from ? { from: one.ask.from } : {}),
        at: String(one.at),
      })),
  );

export const Desk = {
  asks,
  cancelHandoff: DeskHandoff.cancel,
  handOff: DeskHandoff.schedule,
  routes: DeskRoutes.of,
  standing: DeskStandings.of,
};
