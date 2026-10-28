import z from "zod";
import { Desk } from "~~/server/utils/desk";
import { Projects } from "~~/server/utils/projects";
import { TaskLane } from "~~/server/utils/tasks/lane";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { TaskAssigned } from "~~/shared/types/desk";
import { TaskState } from "~~/shared/types/task";

const Body = z.object({
  project: z.string().min(1).optional(),
  state: z.enum(TaskState).optional(),
  reason: z.string().trim().min(1).optional(),
});

export default defineEventHandler(async (event): Promise<TaskAssigned> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  const { project, state, reason } = await readValidatedBody(event, (raw) => Body.parse(raw ?? {}));
  const caller = { who: "YOU" } as const;
  if (state) {
    if (state === "unassigned") Desk.cancelHandoff(file.slug);
    const moved = await Promise.resolve()
      .then(() => TaskLane.state({ given: file.slug, caller, state, ...(reason ? { reason } : {}) }))
      .catch(TaskRoute.refused);
    return { state: moved.task.state, ...(moved.task.project ? { project: moved.task.project } : {}) };
  }
  if (!project) {
    Desk.cancelHandoff(file.slug);
    const back = TaskLane.state({ given: file.slug, caller, state: "unassigned" });
    return { state: back.task.state };
  }
  const next = await Promise.resolve()
    .then(() => TaskLane.assign({ given: file.slug, caller, project }))
    .catch(TaskRoute.refused);
  const on = Projects.list().find((one) => one.key === next.task.project);
  return {
    state: next.task.state,
    project: next.task.project,
    ...(on ? Desk.handOff({ file: next, project: on }) : {}),
  };
});
