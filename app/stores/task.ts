import type { Project } from "~~/shared/types/task";

export const $task = defineStore(() => {
  const projects = ref<Project[]>([]);
  const isEditing = ref(false);
  const tuneAsks = ref(0);
  const opened = ref<Partial<Record<string, boolean>>>({});

  async function loadProjects(): Promise<void> {
    if (projects.value.length) return;
    projects.value = await $fetch<Project[]>("/api/projects").catch(() => []);
  }

  function askTune(): void {
    tuneAsks.value += 1;
  }

  return { askTune, isEditing, loadProjects, opened, projects, tuneAsks };
});
