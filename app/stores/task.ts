import type { ArtifactDetail, ArtifactMeta, ReviewThread } from "~~/shared/types/artifact";
import type { FileContent } from "~~/shared/types/files";
import type { HistoryEntry, TaskDecided, TaskStands } from "~~/shared/types/history";
import type { Project } from "~~/shared/types/task";
import { Parts, type Part } from "~~/shared/utils/parts";

export type TaskFace = "document" | "history";
export type Answer = { option: number } | { text: string };

export interface ShowOptions {
  slug?: string;
  edit?: boolean;
  replace?: boolean;
}

export const $task = defineStore(() => {
  const sc = useSidecar();
  const chrome = useChrome();
  const route = useRoute();
  const projects = ref<Project[]>([]);
  const isEditing = ref(false);
  const tuneAsks = ref(0);
  const slug = ref<string>();
  const face = ref<TaskFace>("document");
  const editsNext = ref<string>();
  const entries = ref<HistoryEntry[]>([]);
  const asks = ref<ReviewThread[]>([]);
  const parts = ref<Part[]>([]);
  const stands = ref<TaskStands>();
  const isStanding = ref(false);
  const picked = ref(-1);
  const onlyDecisions = ref(false);

  const loadProjects = async (): Promise<void> => {
    if (projects.value.length) return;
    projects.value = await $fetch<Project[]>("/api/projects").catch(() => []);
  };

  const readTasks = async (): Promise<void> => {
    sc.catalogue.value = await $fetch<ArtifactMeta[]>("/api/artifacts").catch(() => sc.catalogue.value);
  };

  const askTune = (): void => {
    tuneAsks.value += 1;
  };

  const refresh = async (): Promise<void> => {
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
  };

  const stand = async (): Promise<void> => {
    const at = slug.value;
    if (!at) return;
    isStanding.value = true;
    const reply = await $fetch<{ stands?: TaskStands }>(`/api/tasks/${encodeURIComponent(at)}/stands`).catch(
      (): { stands?: TaskStands } => ({}),
    );
    if (slug.value !== at) return;
    stands.value = reply.stands;
    isStanding.value = false;
  };

  const open = async (next: string): Promise<void> => {
    if (slug.value !== next) {
      slug.value = next;
      face.value = "document";
      entries.value = [];
      asks.value = [];
      parts.value = [];
      stands.value = undefined;
      picked.value = -1;
      onlyDecisions.value = false;
    }
    await refresh();
  };

  const close = (): void => {
    slug.value = undefined;
    isEditing.value = false;
  };

  const takeEdit = (at: string): boolean => {
    const wanted = editsNext.value === at;
    if (wanted) editsNext.value = undefined;
    return wanted;
  };

  const show = ({ slug: next, edit = false, replace = false }: ShowOptions = {}): void => {
    if (next) {
      if (edit) editsNext.value = next;
      void open(next);
    }
    chrome.view.set("tasks");
    const onFaces = route.path.startsWith("/c/") && !route.params.slug;
    if (onFaces) return;
    const key = sc.sessionKey.value;
    void navigateTo(key ? `/c/${key}` : "/", { replace });
  };

  const decide = async (thread: string, answer: Answer): Promise<TaskDecided> => {
    const at = slug.value ?? "";
    const decided = await $fetch<TaskDecided>(`/api/tasks/${encodeURIComponent(at)}/decide`, {
      method: "POST",
      body: { thread, ...answer },
    });
    await refresh();
    return decided;
  };

  return {
    askTune,
    asks,
    close,
    decide,
    entries,
    face,
    isEditing,
    isStanding,
    loadProjects,
    onlyDecisions,
    open,
    parts,
    picked,
    projects,
    readTasks,
    refresh,
    show,
    slug,
    stand,
    stands,
    takeEdit,
    tuneAsks,
  };
});
