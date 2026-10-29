import { useLocalStorage } from "@vueuse/core";
import type { DockSize, DockTab } from "~~/shared/types/dock";
import type { Project } from "~~/shared/types/task";

export const DOCK_TOOLS = ["terminal", "run"] as const;
export type DockTool = (typeof DOCK_TOOLS)[number];

export interface DockProject {
  key: string;
  name: string;
  folder?: string;
  project?: Project;
  tint?: string;
}

const NO_PROJECT = "none";

export const $dock = defineStore(() => {
  const sc = useSidecar();
  const task = $task();
  const tree = useOrgTree();
  const router = useRouter();
  // Before both lists land, a conversation reads as No project, and its shell would open in the wrong folder.
  const isReady = computed(() => sc.ready.value && task.projects.length > 0);
  void task.loadProjects();
  const isOpen = useLocalStorage("sc:dock-open", false);
  const tool = useLocalStorage<DockTool>("sc:dock-tool", "terminal");
  const height = useLocalStorage("sc:dock-height", 300);
  const tabs = ref<DockTab[]>([]);
  const picked = ref<Record<string, string>>({});
  const size = ref<DockSize>({ cols: 100, rows: 16 });

  const projectOf = (key: string): DockProject => {
    const group = Org.placeOf(tree.value, key)?.group;
    if (group) {
      const { project, tint } = group;
      return { key: project.key, name: project.name, folder: project.folder, project, tint };
    }
    const cwd = sc.sessions.value.find((one) => one.key === key)?.cwd;
    return { key: NO_PROJECT, name: "No project", ...(cwd ? { folder: cwd } : {}) };
  };

  const groupOf = (project: string): DockProject => {
    const group = tree.value.projects.find((one) => one.project.key === project);
    return group
      ? { key: project, name: group.project.name, project: group.project, tint: group.tint }
      : { key: project, name: project === NO_PROJECT ? "No project" : project };
  };

  const toolOf = (tab: DockTab): DockTool => (tab.kind === "run" ? "run" : "terminal");

  const slotOf = (project: string, of: DockTool): string => `${of}:${project}`;

  const tabsOf = (project: string, of: DockTool): DockTab[] =>
    tabs.value.filter((one) => one.project === project && toolOf(one) === of);

  const shownOf = (project: string, of: DockTool): DockTab | undefined => {
    const theirs = tabsOf(project, of);
    return theirs.find((one) => one.id === picked.value[slotOf(project, of)]) ?? theirs[0];
  };

  const pick = (tab: DockTab): void => {
    picked.value = { ...picked.value, [slotOf(tab.project, toolOf(tab))]: tab.id };
  };

  const added = (tab: DockTab): void => {
    tabs.value = [...tabs.value.filter((one) => one.id !== tab.id), tab];
    pick(tab);
    tool.value = toolOf(tab);
    isOpen.value = true;
  };

  const load = async (): Promise<void> => {
    tabs.value = await $fetch<DockTab[]>("/api/dock").catch(() => tabs.value);
  };

  const heard = (next: { tabs: DockTab[] }): void => {
    tabs.value = next.tabs;
  };

  const openShell = async (where: DockProject): Promise<void> => {
    const body = { project: where.key, ...(where.folder ? { folder: where.folder } : {}), ...size.value };
    added(await $fetch<DockTab>("/api/dock/shell", { method: "POST", body }));
  };

  // The dock shows only the project in front, so attaching another project's conversation goes to it, as any pick does.
  const attach = async (key: string): Promise<void> => {
    const where = projectOf(key);
    added(
      await $fetch<DockTab>("/api/dock/session", { method: "POST", body: { project: where.key, key, ...size.value } }),
    );
    const front = String(router.currentRoute.value.params.key ?? "");
    if (where.key !== projectOf(front).key) await navigateTo(`/c/${key}`);
  };

  const holds = (key: string): boolean => tabs.value.some((one) => one.key === key);

  const toggle = (): void => {
    isOpen.value = !isOpen.value;
  };

  return {
    added,
    attach,
    groupOf,
    heard,
    height,
    holds,
    isOpen,
    isReady,
    load,
    openShell,
    pick,
    projectOf,
    shownOf,
    size,
    tabs,
    tabsOf,
    toggle,
    tool,
  };
});
