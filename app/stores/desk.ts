import type { DeskAsk, DeskTriage, TaskAssigned } from "~~/shared/types/desk";
import type { Project } from "~~/shared/types/task";
import type { TaskMeta } from "~/utils/tasks";

export const $desk = defineStore(() => {
  const UNDO_MS = 8000;
  const chrome = useChrome();
  const task = $task();
  const asks = ref<DeskAsk[]>([]);
  const routes = ref<DeskTriage["routes"]>({});
  const dragging = ref<string>();
  const isNaming = ref(false);
  let placed: { meta: TaskMeta; until: number } | undefined;

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
    const last = placed;
    placed = undefined;
    if (!last) return;
    await move(last.meta.slug).then(
      () => chrome.toast(`${titleOf(last.meta)} is back in the inbox`),
      () => chrome.toast(`Could not put ${titleOf(last.meta)} back in the inbox`, "destructive"),
    );
    await task.readTasks();
  };

  const place = async (meta: TaskMeta, project: Project): Promise<void> => {
    const moved = await move(meta.slug, project.key).catch(() => undefined);
    await task.readTasks();
    if (!moved) return chrome.toast(`Could not put ${titleOf(meta)} on ${project.name}`, "destructive");
    placed = { meta, until: Date.now() + UNDO_MS };
    const next = moved.lead
      ? "and its Project Lead reads it next."
      : "and no Project Lead runs there yet, so it waits on the board.";
    chrome.notify({
      text: `${titleOf(meta)} went to ${project.name}, ${next}`,
      action: "Undo",
      tip: "Undo · ⌘Z",
      open: () => void undo(),
    });
  };

  const undoLast = (): boolean => {
    if (!placed || placed.until < Date.now()) return false;
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

  return { asks, create, dragging, isNaming, load, move, place, routes, undoLast };
});
