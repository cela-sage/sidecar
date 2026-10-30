import type { Life } from "../../../shared/types/session.ts";
import { jobs, type JobEntry } from "./jobs.ts";
import { entryOf, type RegistryEntry } from "./registry.ts";

interface Holding {
  entry?: RegistryEntry;
  job?: JobEntry;
}

// A job's pid covers the moment a session has started and its registry file is not written yet.
const of = ({ entry, job }: Holding): Life => (entry || job?.pid ? "alive" : "killed");

const ofKey = (key: string): Life => of({ entry: entryOf(key), job: jobs().find((one) => one.key === key) });

export const Lives = { of, ofKey };
