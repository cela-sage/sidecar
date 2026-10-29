import type { RunGroup } from "../../shared/types/runs.ts";

const isInside = (cwd: string, folder: string): boolean => cwd === folder || cwd.startsWith(`${folder}/`);

const frontFirst = (groups: RunGroup[], cwd?: string): RunGroup[] => {
  if (!cwd) return groups;
  const front = groups.filter((group) => group.repo && group.configs.some((one) => isInside(cwd, one.folder)));
  return [...front, ...groups.filter((group) => !front.includes(group))];
};

export const RunOrder = { frontFirst };
