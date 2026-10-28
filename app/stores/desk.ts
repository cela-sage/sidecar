import type { DeskAsk, DeskTriage, TaskAssigned } from "~~/shared/types/desk";
import type { Retitled } from "~~/shared/types/session";
import type { Project } from "~~/shared/types/task";
import { Titles } from "~~/shared/utils/titles";
import type { OrgConversation } from "~/utils/org";
import type { TaskMeta } from "~/utils/tasks";

export const $desk = defineStore(() => {
  const UNDO_MS = 8000;
  const sc = useSidecar();
  const chrome = useChrome();
  const task = $task();
  const asks = ref<DeskAsk[]>([]);
  const routes = ref<DeskTriage["routes"]>({});
  const dragging = ref<string>();
  const carrying = ref<string>();
  const isNaming = ref(false);
  let last: { undo: () => Promise<void>; until: number } | undefined;

  const load = async (): Promise<void> => {
    const triage = await $fetch<DeskTriage>("/api/desk").catch(() => undefined);
    if (!triage) return;
    asks.value = triage.asks;
    routes.value = triage.routes;
  };

  const move = (slug: string, project?: string): Promise<TaskAssigned> =>
    $fetch<TaskAssigned>(`/api/tasks/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: project ? { project } : {},
    });

  const titleOf = (meta: TaskMeta): string => meta.title || deslug(meta.slug);

  const undo = async (): Promise<void> => {
    const taken = last;
    last = undefined;
    await taken?.undo();
  };

  const offer = (text: string, undoing: () => Promise<void>): void => {
    last = { undo: undoing, until: Date.now() + UNDO_MS };
    chrome.notify({ text, action: "Undo", tip: "Undo · ⌘Z", open: () => void undo() });
  };

  const unplace = async (meta: TaskMeta): Promise<void> => {
    await move(meta.slug).then(
      () => chrome.toast(`${titleOf(meta)} is back in the inbox`),
      () => chrome.toast(`Could not put ${titleOf(meta)} back in the inbox`, "destructive"),
    );
    await task.readTasks();
  };

  const place = async (meta: TaskMeta, project: Project): Promise<void> => {
    const moved = await move(meta.slug, project.key).catch(() => undefined);
    await task.readTasks();
    if (!moved) return chrome.toast(`Could not put ${titleOf(meta)} on ${project.name}`, "destructive");
    const next = moved.lead
      ? "and its Project Lead reads it next."
      : "and no Project Lead runs there yet, so it waits on the board.";
    offer(`${titleOf(meta)} went to ${project.name}, ${next}`, () => unplace(meta));
  };

  const rename = async (key: string, title: string): Promise<boolean> => {
    const done = await $fetch<Retitled>(`/api/sessions/${key}`, { method: "PATCH", body: { title } }).catch(
      () => undefined,
    );
    if (done) sc.sessions.value = sc.sessions.value.map((one) => (one.key === key ? { ...one, name: title } : one));
    return !!done;
  };

  const lead = async (row: OrgConversation, meta: TaskMeta, project: Project): Promise<void> => {
    const was = sc.sessions.value.find((one) => one.key === row.key)?.name;
    const title = Titles.asLead({ was: row.title, token: project.token, slug: meta.slug });
    if (!(await rename(row.key, title)))
      return chrome.toast(`Could not put ${row.name} on ${titleOf(meta)}`, "destructive");
    const text = `${row.name} joined ${titleOf(meta)} as a Task Lead.`;
    if (!was) return chrome.toast(text);
    offer(text, async () => {
      if (!(await rename(row.key, was))) chrome.toast(`Could not rename ${row.name} back`, "destructive");
    });
  };

  const undoLast = (): boolean => {
    if (!last || last.until < Date.now()) return false;
    void undo();
    return true;
  };

  const create = async (title: string): Promise<string | undefined> => {
    const made = await $fetch<{ slug: string }>("/api/tasks", { method: "POST", body: { title } }).catch(
      () => undefined,
    );
    if (!made) {
      chrome.toast("Could not create the task", "destructive");
      return undefined;
    }
    await task.readTasks();
    return made.slug;
  };

  return { asks, carrying, create, dragging, isNaming, lead, load, move, place, routes, undoLast };
});
