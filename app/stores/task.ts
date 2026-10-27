import type { ArtifactDetail, ReviewThread } from "~~/shared/types/artifact";
import type { FileContent } from "~~/shared/types/files";
import type { HistoryEntry, TaskDecided, TaskStands } from "~~/shared/types/history";
import type { Project } from "~~/shared/types/task";
import { Parts, type Part } from "~~/shared/utils/parts";

export type TaskFace = "document" | "history";
export type Answer = { option: number } | { text: string };

export const $task = defineStore(() => {
  const projects = ref<Project[]>([]);
  const isEditing = ref(false);
  const tuneAsks = ref(0);
  const opened = ref<Partial<Record<string, boolean>>>({});
  const slug = ref<string>();
  const entries = ref<HistoryEntry[]>([]);
  const asks = ref<ReviewThread[]>([]);
  const parts = ref<Part[]>([]);
  const stands = ref<TaskStands>();
  const isStanding = ref(false);
  const picked = ref(-1);
  const onlyDecisions = ref(false);

  async function loadProjects(): Promise<void> {
    if (projects.value.length) return;
    projects.value = await $fetch<Project[]>("/api/projects").catch(() => []);
  }

  function askTune(): void {
    tuneAsks.value += 1;
  }

  async function refresh(): Promise<void> {
    const at = slug.value;
    if (!at) return;
    const path = encodeURIComponent(at);
    const [history, detail, source] = await Promise.all([
      $fetch<{ entries: HistoryEntry[] }>(`/api/tasks/${path}/history`).catch(() => ({ entries: [] })),
      $fetch<ArtifactDetail>(`/api/artifacts/${path}`).catch(() => undefined),
      $fetch<FileContent>(`/api/artifacts/${path}/source`).catch(() => undefined),
    ]);
    if (slug.value !== at) return;
    entries.value = history.entries;
    asks.value = (detail?.threads ?? []).filter((thread) => !!thread.ask);
    parts.value = source && "text" in source ? Parts.of(source.text) : [];
  }

  async function stand(): Promise<void> {
    const at = slug.value;
    if (!at) return;
    isStanding.value = true;
    const reply = await $fetch<{ stands?: TaskStands }>(`/api/tasks/${encodeURIComponent(at)}/stands`).catch(
      (): { stands?: TaskStands } => ({}),
    );
    if (slug.value !== at) return;
    stands.value = reply.stands;
    isStanding.value = false;
  }

  async function open(next: string): Promise<void> {
    if (slug.value !== next) {
      slug.value = next;
      entries.value = [];
      asks.value = [];
      parts.value = [];
      stands.value = undefined;
      picked.value = -1;
      onlyDecisions.value = false;
    }
    await refresh();
  }

  async function decide(thread: string, answer: Answer): Promise<TaskDecided> {
    const at = slug.value ?? "";
    const decided = await $fetch<TaskDecided>(`/api/tasks/${encodeURIComponent(at)}/decide`, {
      method: "POST",
      body: { thread, ...answer },
    });
    await refresh();
    return decided;
  }

  return {
    askTune,
    asks,
    decide,
    entries,
    isEditing,
    isStanding,
    loadProjects,
    onlyDecisions,
    open,
    opened,
    parts,
    picked,
    projects,
    refresh,
    slug,
    stand,
    stands,
    tuneAsks,
  };
});
