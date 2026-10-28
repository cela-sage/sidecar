import { appendFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jobStateOf, refreshJobs } from "./jobs.ts";
import { jobsHome } from "./paths.ts";
import { transcriptIndex } from "./transcripts.ts";

export interface Retitle {
  key: string;
  title: string;
}

// The job list reads its own name rather than the transcript's, and a name marked as yours is never renamed for you.
export async function retitle({ key, title }: Retitle): Promise<boolean> {
  const transcript = transcriptIndex().get(key);
  const state = jobStateOf(key);
  if (!transcript && !state) return false;
  if (transcript) {
    const record = { type: "custom-title", customTitle: title, sessionId: transcript.id };
    appendFileSync(transcript.path, `${JSON.stringify(record)}\n`);
  }
  if (state) {
    const path = join(jobsHome(), key, "state.json");
    writeFileSync(`${path}.tmp`, JSON.stringify({ ...state, name: title, nameSource: "user" }, undefined, 2));
    renameSync(`${path}.tmp`, path);
    await refreshJobs();
  }
  return true;
}
