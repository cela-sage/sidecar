import type { Project } from "../../../shared/types/task.ts";
import { Titles } from "../../../shared/utils/titles.ts";
import { deliver } from "../sessions/inbox.ts";
import { keyOf } from "../sessions/paths.ts";
import { liveEntries } from "../sessions/registry.ts";
import type { TaskFile } from "../tasks/file.ts";

export interface HandoffInput {
  file: TaskFile;
  project: Project;
}

const UNDO_MS = 8000;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

const leadOf = (project: Project): { key: string; name: string } | undefined => {
  const [entry] = liveEntries()
    .filter((one) => {
      const title = one.name ? Titles.parse(one.name) : undefined;
      return title?.role === "PL" && title.token === project.token;
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return entry?.name ? { key: keyOf(entry.id), name: entry.name } : undefined;
};

const cancel = (slug: string): void => {
  clearTimeout(pending.get(slug));
  pending.delete(slug);
};

const schedule = ({ file, project }: HandoffInput): string | undefined => {
  cancel(file.slug);
  const lead = leadOf(project);
  if (!lead) return undefined;
  const text = `I put ${file.title} on ${project.name} from the Desk, it's ${file.path}. Assess it, then spawn a Task Lead or fold it into one already running. sidecar task ${file.slug} has its history.`;
  pending.set(
    file.slug,
    setTimeout(() => {
      pending.delete(file.slug);
      void deliver({ key: lead.key, text, slug: file.slug }).then((sent) => {
        if (!sent.delivered) console.error(`sidecar: ${lead.name} did not take ${file.slug}: ${sent.reason}`);
      });
    }, UNDO_MS),
  );
  return lead.name;
};

export const DeskHandoff = { cancel, schedule };
