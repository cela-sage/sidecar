import type { Killed, Refused, Resumed } from "~~/shared/types/channel";
import type { DeskAsk, DeskTriage, LeadJoined, TaskAssigned, TaskRemoved } from "~~/shared/types/desk";
import type { HistoryEntry } from "~~/shared/types/history";
import type { Retitled } from "~~/shared/types/session";
import type { Project, TaskState } from "~~/shared/types/task";
import { Titles } from "~~/shared/utils/titles";
import type { OrgConversation } from "~/utils/org";
import type { TaskMeta } from "~/utils/tasks";

interface Retitle {
  row: OrgConversation;
  title: string;
  done: string;
  failed: string;
}

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
  const renaming = ref<string>();
  let last: { undo: () => Promise<unknown>; until: number } | undefined;

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

  const offer = (text: string, undoing: () => Promise<unknown>): void => {
    last = { undo: undoing, until: Date.now() + UNDO_MS };
    chrome.notify({ text, action: "Undo", tip: "Undo · ⌘Z", open: () => void undo() });
  };

  const unplace = async (meta: TaskMeta): Promise<void> => {
    await move(meta.slug).then(
      () => chrome.toast(`${titleOf(meta)} is back in the backlog`),
      () => chrome.toast(`Could not put ${titleOf(meta)} back in the backlog`, "destructive"),
    );
    await task.readTasks();
  };

  const place = async (meta: TaskMeta, project: Project): Promise<void> => {
    const moved = await move(meta.slug, project.key).catch(() => undefined);
    await task.readTasks();
    if (!moved) return chrome.toast(`Could not put ${titleOf(meta)} on ${project.name}`, "destructive");
    const next = moved.lead
      ? "and its Domain Lead reads it next."
      : moved.starts
        ? "and a new Domain Lead starts on it."
        : "and no Domain Lead can run there, so it waits on the board.";
    offer(`${titleOf(meta)} went to ${project.name}, ${next}`, () => unplace(meta));
  };

  const named = (key: string, title: string): void => {
    sc.sessions.value = sc.sessions.value.map((one) => (one.key === key ? { ...one, name: title } : one));
  };

  const rename = async (key: string, title: string): Promise<boolean> => {
    const done = await $fetch<Retitled>(`/api/sessions/${key}`, { method: "PATCH", body: { title } }).catch(
      () => undefined,
    );
    if (done) named(key, title);
    return !!done;
  };

  const renameConversation = async ({
    key,
    title,
    name,
  }: {
    key: string;
    title: string;
    name: string;
  }): Promise<void> => {
    if (await rename(key, title)) return chrome.toast(`Renamed ${name} to ${title}`);
    chrome.toast(`Could not rename ${name}`, "destructive");
  };

  const removeConversation = async ({ key, name }: { key: string; name: string }): Promise<void> => {
    try {
      await $fetch(`/api/sessions/${key}`, { method: "DELETE" });
      sc.sessions.value = sc.sessions.value.filter((session) => session.key !== key);
      chrome.toast(`Removed ${name}. Its transcript stays on disk.`, "success");
    } catch (error) {
      chrome.toast(`Could not remove ${name}. ${failReason(error) ?? "The sidecar refused it."}`, "destructive");
    }
  };

  const retitle = async ({ row, title, done, failed }: Retitle): Promise<void> => {
    const was = sc.sessions.value.find((one) => one.key === row.key)?.name;
    if (!(await rename(row.key, title))) return chrome.toast(failed, "destructive");
    if (!was) return chrome.toast(done);
    offer(done, async () => {
      if (!(await rename(row.key, was))) chrome.toast(`Could not rename ${row.name} back`, "destructive");
    });
  };

  const lead = async (row: OrgConversation, meta: TaskMeta): Promise<void> => {
    const was = sc.sessions.value.find((one) => one.key === row.key)?.name;
    const at = `/api/tasks/${encodeURIComponent(meta.slug)}/lead`;
    const joined = await $fetch<LeadJoined>(at, { method: "POST", body: { key: row.key } }).catch(() => undefined);
    if (!joined) return chrome.toast(`Could not put ${row.name} on ${titleOf(meta)}`, "destructive");
    named(row.key, joined.title);
    offer(`${row.name} joined ${titleOf(meta)} as an Individual Contributor, and reads it next.`, async () => {
      await $fetch(at, { method: "DELETE", query: { key: row.key } }).catch(() => undefined);
      if (was && !(await rename(row.key, was))) chrome.toast(`Could not rename ${row.name} back`, "destructive");
    });
  };

  const bring = (row: OrgConversation, project: Project): Promise<void> =>
    retitle({
      row,
      title: Titles.inProject({ was: row.title, token: project.token }),
      done: `${row.name} moved to ${project.name}.`,
      failed: `Could not move ${row.name} to ${project.name}`,
    });

  const failing =
    (what: string) =>
    (error: unknown): undefined => {
      chrome.toast(failReason(error) ?? what, "destructive");
    };

  const attempt = async (run: Promise<unknown>, what: string): Promise<boolean> =>
    (await run.then(() => true, failing(what))) ?? false;

  const shelve = (meta: TaskMeta, state: TaskState, what: string): Promise<boolean> =>
    attempt(task.move(meta.slug, state), what);

  const archive = async (meta: TaskMeta): Promise<void> => {
    const was = meta.task.state;
    if (!(await shelve(meta, "archived", `Could not archive ${titleOf(meta)}`))) return;
    offer(`${titleOf(meta)} is archived. Restore it from Archived.`, () =>
      shelve(meta, was, `Could not bring ${titleOf(meta)} back`),
    );
  };

  const restore = async (meta: TaskMeta): Promise<void> => {
    const at = `/api/tasks/${encodeURIComponent(meta.slug)}/history`;
    const { entries } = await $fetch<{ entries: HistoryEntry[] }>(at).catch(() => ({ entries: [] }));
    const back = Tasks.stateBeforeArchive(entries);
    if (!(await shelve(meta, back, `Could not restore ${titleOf(meta)}`))) return;
    offer(`${titleOf(meta)} is back, with its channel. Its agents stay killed.`, () =>
      shelve(meta, "archived", `Could not archive ${titleOf(meta)} again`),
    );
  };

  const killWorkstream = (slug: string): Promise<Killed> =>
    $fetch<Killed>(`/api/tasks/${encodeURIComponent(slug)}/kill`, { method: "POST" });

  const unkillWorkstream = (slug: string, keys: string[]): Promise<Resumed> =>
    $fetch<Resumed>(`/api/tasks/${encodeURIComponent(slug)}/resume`, { method: "POST", body: { keys } });

  const refusedLine = (refused: Refused[]): string =>
    new Intl.ListFormat("en").format(
      refused.map(({ key, reason }) => {
        const session = sc.sessions.value.find((one) => one.key === key);
        return `${session?.agent?.name ?? (session ? nameOf(session) : key)} (${reason})`;
      }),
    );

  const kill = async (meta: TaskMeta): Promise<void> => {
    const done = await killWorkstream(meta.slug).catch(failing(`Could not kill ${titleOf(meta)}'s agents`));
    if (!done) return;
    if (done.refused.length) chrome.toast(`Could not stop ${refusedLine(done.refused)}`, "destructive");
    if (!done.killed.length) return;
    offer(
      `${plural(done.killed.length, "agent")} on ${titleOf(meta)} killed. The Domain Lead, the Solution Lead and your Assistant stay.`,
      async () => {
        const back = await unkillWorkstream(meta.slug, done.killed).catch(
          failing(`Could not bring ${titleOf(meta)}'s agents back`),
        );
        if (back?.refused.length) chrome.toast(`Could not resume ${refusedLine(back.refused)}`, "destructive");
      },
    );
  };

  const remove = async (meta: TaskMeta): Promise<void> => {
    const at = `/api/tasks/${encodeURIComponent(meta.slug)}`;
    const gone = await $fetch<TaskRemoved>(at, { method: "DELETE" }).catch((error: unknown) => {
      chrome.toast(failReason(error) ?? `Could not remove ${titleOf(meta)}`, "destructive");
      return undefined;
    });
    if (!gone) return;
    if (task.slug === meta.slug) task.close();
    await task.readTasks();
    const stopped = gone.stopped.length
      ? ` ${plural(gone.stopped.length, "Individual Contributor")} stopped and stay stopped if you undo.`
      : "";
    offer(`${titleOf(meta)} is removed.${stopped}`, async () => {
      const back = await $fetch(`${at}/restore`, { method: "POST" }).catch(() => undefined);
      await task.readTasks();
      if (!back) chrome.toast(`Could not bring ${titleOf(meta)} back`, "destructive");
    });
  };

  const renameTask = async (meta: TaskMeta, title: string): Promise<void> => {
    renaming.value = undefined;
    if (title === titleOf(meta)) return;
    const at = `/api/tasks/${encodeURIComponent(meta.slug)}`;
    const done = await $fetch(at, { method: "PATCH", body: { title } }).catch((error: unknown) => {
      chrome.toast(failReason(error) ?? `Could not rename ${titleOf(meta)}`, "destructive");
      return undefined;
    });
    if (done) await Promise.all([task.readTasks(), task.slug === meta.slug ? task.refresh() : undefined]);
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
      chrome.toast("Could not create the workstream", "destructive");
      return undefined;
    }
    await task.readTasks();
    return made.slug;
  };

  return {
    asks,
    archive,
    bring,
    carrying,
    create,
    dragging,
    isNaming,
    kill,
    lead,
    load,
    move,
    place,
    remove,
    removeConversation,
    renameConversation,
    renameTask,
    renaming,
    restore,
    routes,
    undoLast,
  };
});
