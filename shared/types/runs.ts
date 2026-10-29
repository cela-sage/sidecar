export const RunSource = ["package.json", "Makefile", "assistant"] as const;
export type RunSource = (typeof RunSource)[number];

export const RunStatus = ["running", "passed", "failed", "stopped"] as const;
export type RunStatus = (typeof RunStatus)[number];

export interface RunConfig {
  id: string;
  name: string;
  command: string;
  shown: string;
  folder: string;
  source: RunSource;
  repo?: string;
}

export interface RunGroup {
  source: RunSource;
  repo?: string;
  configs: RunConfig[];
}
