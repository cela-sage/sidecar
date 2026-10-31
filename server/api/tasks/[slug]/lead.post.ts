import z from "zod";
import { Desk } from "~~/server/utils/desk";
import { Projects } from "~~/server/utils/projects";
import { liveSessions } from "~~/server/utils/sessions";
import { isKey } from "~~/server/utils/sessions/paths";
import { retitle } from "~~/server/utils/sessions/title";
import { TaskRoute } from "~~/server/utils/tasks/route";
import type { LeadJoined } from "~~/shared/types/desk";
import { Titles } from "~~/shared/utils/titles";
import { Workstreams } from "~~/shared/utils/workstream";

const Body = z.object({ key: z.string().toLowerCase().refine(isKey, "a session's 8-hex key") });

export default defineEventHandler(async (event): Promise<LeadJoined> => {
  const file = await TaskRoute.task(getRouterParam(event, "slug") ?? "");
  const { key } = await readValidatedBody(event, (raw) => Body.parse(raw));
  const project = Projects.list().find((one) => one.key === file.task.project);
  if (!project || Workstreams.isArchived(file.task.state))
    throw createError({
      statusCode: 409,
      statusMessage: "refused",
      message: `${file.slug} takes no Individual Contributor now`,
    });
  const session = liveSessions({ key }).find((one) => one.key === key);
  if (!session) throw createError({ statusCode: 404, statusMessage: "no such conversation" });
  const was = session.name || session.cwd.split("/").filter(Boolean).at(-1) || key;
  const title = Titles.asLead({ was, token: project.token, slug: file.slug });
  await retitle({ key, title });
  Desk.lead({ file, project, key, title });
  return { key, title };
});
