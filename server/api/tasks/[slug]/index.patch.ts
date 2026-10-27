import z from "zod";
import { Desk } from "~~/server/utils/desk";
import { Projects } from "~~/server/utils/projects";
import { TaskLane } from "~~/server/utils/tasks/lane";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { TaskAssigned } from "~~/shared/types/desk";

const Body = z.object({ project: z.string().min(1).optional() });

export default defineEventHandler(async (event): Promise<TaskAssigned> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  const { project } = await readValidatedBody(event, (raw) => Body.parse(raw ?? {}));
  const caller = { who: "YOU" } as const;
  if (!project) {
    Desk.cancelHandoff(file.slug);
    const back = TaskLane.state({ given: file.slug, caller, state: "unassigned" });
    return { state: back.task.state };
  }
  const next = await Promise.resolve()
    .then(() => TaskLane.assign({ given: file.slug, caller, project }))
    .catch(TaskRoute.refused);
  const on = Projects.list().find((one) => one.key === next.task.project);
  const lead = on ? Desk.handOff({ file: next, project: on }) : undefined;
  return { state: next.task.state, project: next.task.project, ...(lead ? { lead } : {}) };
});
