import type { Project } from "../../../shared/types/task.ts";
import { Titles } from "../../../shared/utils/titles.ts";
import { deliver } from "../sessions/inbox.ts";
import { keyOf } from "../sessions/paths.ts";
import { liveEntries } from "../sessions/registry.ts";
import { Roles } from "../sessions/roles.ts";
import type { TaskFile } from "../tasks/file.ts";
import { TaskLane } from "../tasks/lane.ts";

export interface HandoffInput {
  file: TaskFile;
  project: Project;
}

export interface LeadInput extends HandoffInput {
  key: string;
  title: string;
}

export interface Handed {
  lead?: string;
  starts?: true;
}

const UNDO_MS = 8000;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

const leadOf = (project: Project): { key: string; name: string } | undefined => {
  const [entry] = liveEntries()
    .filter((one) => {
      const title = one.name ? Titles.parse(one.name) : undefined;
      return title?.role === "DL" && title.token === project.token;
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return entry?.name ? { key: keyOf(entry.id), name: entry.name } : undefined;
};

const later = (id: string, run: () => Promise<unknown>): void => {
  clearTimeout(pending.get(id));
  pending.set(
    id,
    setTimeout(() => {
      pending.delete(id);
      void run();
    }, UNDO_MS),
  );
};

const cancel = (id: string): void => {
  clearTimeout(pending.get(id));
  pending.delete(id);
};

const send = async ({
  key,
  name,
  text,
  slug,
}: {
  key: string;
  name: string;
  text: string;
  slug: string;
}): Promise<void> => {
  const sent = await deliver({ key, text, slug });
  if (!sent.delivered) console.error(`sidecar: ${name} did not take ${slug}: ${sent.reason}`);
};

const schedule = ({ file, project }: HandoffInput): Handed => {
  cancel(file.slug);
  if (!project.folder) return {};
  const lead = leadOf(project);
  const text = `You're the Domain Lead of ${project.name}. I put ${file.title} on it from the Desk, it's ${file.path}. Assess it, then spawn an Individual Contributor or fold it into one already running. sidecar task ${file.slug} has its history.`;
  if (lead) {
    later(file.slug, () => send({ ...lead, text, slug: file.slug }));
    return { lead: lead.name };
  }
  const name = `[${project.token}] DL ${project.name}`;
  later(file.slug, async () => {
    const ran = await Roles.launch({ agent: Roles.agentOf("DL"), cwd: project.folder, prompt: text, by: "YOU", name });
    if ("failed" in ran) return console.error(`sidecar: no Domain Lead started for ${file.slug}: ${ran.failed}`);
    TaskLane.heard({ caller: { who: "YOU", from: name }, kind: "message", text, slug: file.slug });
  });
  return { starts: true };
};

const leadId = (slug: string, key: string): string => `${slug}:${key}`;

// A conversation made an Individual Contributor by a drop was never started as that agent, so the message hands it the file that defines the role.
const lead = ({ file, project, key, title }: LeadInput): void => {
  const role = Roles.fileOf("IC");
  const text = [
    `You're now an Individual Contributor of ${file.title} on ${project.name}, renamed ${title}.`,
    role
      ? `Your role is ${role}: read it first and work by it from here.`
      : "Work as its Individual Contributor from here.",
    `The task is ${file.path}, and sidecar task ${file.slug} has its history and the verbs that move it.`,
  ].join(" ");
  later(leadId(file.slug, key), async () => {
    TaskLane.heard({ caller: { who: "YOU", from: title }, kind: "message", text, slug: file.slug });
    await send({ key, name: title, text, slug: file.slug });
  });
};

export const DeskHandoff = {
  cancel,
  cancelLead: (slug: string, key: string): void => cancel(leadId(slug, key)),
  lead,
  schedule,
};
