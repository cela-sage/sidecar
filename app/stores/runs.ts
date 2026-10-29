import { useLocalStorage } from "@vueuse/core";
import type { DockTab } from "~~/shared/types/dock";
import type { RunConfig, RunGroup } from "~~/shared/types/runs";

export const $runs = defineStore(() => {
  const dock = $dock();
  const sc = useSidecar();
  const chrome = useChrome();
  const groups = ref<Partial<Record<string, RunGroup[]>>>({});
  const picked = useLocalStorage<Record<string, string>>("sc:run-picked", {});

  const load = async (project: string): Promise<void> => {
    const got = await $fetch<RunGroup[]>(`/api/runs/${encodeURIComponent(project)}`).catch(() => undefined);
    if (got) groups.value = { ...groups.value, [project]: got };
  };

  const groupsOf = (project: string, cwd?: string): RunGroup[] => RunOrder.frontFirst(groups.value[project] ?? [], cwd);

  const pickedOf = (project: string, cwd?: string): RunConfig | undefined => {
    const configs = groupsOf(project, cwd).flatMap((group) => group.configs);
    return (
      configs.find((one) => one.id === picked.value[project]) ??
      configs.find((one) => one.name === "dev") ??
      configs[0]
    );
  };

  const tabOf = (project: string, config: string): DockTab | undefined =>
    dock.tabs.find((one) => one.kind === "run" && one.project === project && one.config === config);

  const start = async (project: string, config: RunConfig): Promise<void> => {
    picked.value = { ...picked.value, [project]: config.id };
    const tab = await $fetch<DockTab>(`/api/runs/${encodeURIComponent(project)}`, {
      method: "POST",
      body: { config: config.id, ...dock.size },
    }).catch((error: unknown) => {
      chrome.toast(failReason(error) ?? `${config.name} didn't start`, "destructive");
      return undefined;
    });
    if (tab) dock.added(tab);
  };

  const startCommand = async (conversation: string, command: string): Promise<void> => {
    const folder = sc.sessions.value.find((one) => one.key === conversation)?.cwd;
    const tab = await $fetch<DockTab>(`/api/runs/${encodeURIComponent(dock.projectOf(conversation).key)}`, {
      method: "POST",
      body: { command, ...(folder ? { folder } : {}), ...dock.size },
    }).catch((error: unknown) => {
      chrome.toast(failReason(error) ?? "The command didn't start", "destructive");
      return undefined;
    });
    if (tab) dock.added(tab);
  };

  const stop = async (tab: DockTab): Promise<void> => {
    await $fetch(`/api/dock/${encodeURIComponent(tab.id)}/stop`, { method: "POST" }).catch((error: unknown) =>
      chrome.toast(failReason(error) ?? `${tab.title} didn't stop`, "destructive"),
    );
  };

  return { groupsOf, load, pickedOf, start, startCommand, stop, tabOf };
});
