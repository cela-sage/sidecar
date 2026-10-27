import type { DeskStanding } from "../../../shared/types/desk.ts";
import type { LiveSession } from "../../../shared/types/session.ts";
import type { Project } from "../../../shared/types/task.ts";
import { HistoryLines } from "../../../shared/utils/history.ts";
import { Titles } from "../../../shared/utils/titles.ts";
import { Models } from "../models/index.ts";
import { Projects } from "../projects.ts";
import { liveSessions } from "../sessions/index.ts";
import { TaskFiles, type TaskFile } from "../tasks/file.ts";
import { TaskHistory } from "../tasks/history.ts";

const INSTRUCTION =
  "For each project below, write one sentence for Marco on where it stands: what runs on its own, what waits on a third party, what needs him, or that nothing is open. Name people by role and use plain words. Answer with one line per project, written as key: sentence, and nothing else.";
const SAID_CHARS = 240;

const taskLine = (file: TaskFile): string => {
  const last = TaskHistory.read(file.slug)
    .filter((entry) => entry.kind !== "read")
    .at(-1);
  const { lead = "", text = "" } = last ? HistoryLines.of(last) : {};
  const said = `${lead}${text}`.replace(/\s+/g, " ").slice(0, SAID_CHARS);
  return `- task "${file.title}", ${file.task.state}${said ? `, last: ${said}` : ""}`;
};

const sessionLine = (session: LiveSession): string =>
  `- conversation "${session.name}", ${session.lane?.name ?? session.status ?? "idle"}${session.detail ? `: ${session.detail}` : ""}`;

const contextOf = (projects: Project[], files: TaskFile[], sessions: LiveSession[]): string =>
  projects
    .map((project) => {
      const tasks = files.filter((file) => file.task.project === project.key);
      const talks = sessions.filter((one) => !one.archived && Titles.parse(one.name ?? "")?.token === project.token);
      const lines = [...tasks.map(taskLine), ...talks.map(sessionLine)];
      return [`${project.key} (${project.name})`, ...(lines.length ? lines : ["- nothing open"])].join("\n");
    })
    .join("\n\n");

const parse = (reply: string, keys: string[]): DeskStanding["projects"] => {
  const projects: DeskStanding["projects"] = {};
  for (const line of reply.split("\n")) {
    const hit = /^[\s*-]*`?([\w-]+)`?\s*[:.]\s*(.+)$/.exec(line);
    const key = hit?.[1]?.toLowerCase();
    if (key && hit?.[2] && keys.includes(key)) projects[key] = hit[2].trim();
  }
  return projects;
};

const write = async (): Promise<DeskStanding> => {
  const projects = Projects.list();
  const context = contextOf(projects, TaskFiles.all(), liveSessions({ scope: "live" }));
  const reply = await Models.fast({ task: "answer", instruction: INSTRUCTION, selection: "", context });
  const text = reply.kind === "answer" ? reply.text : reply.replacement;
  return {
    at: new Date().toISOString(),
    projects: parse(
      text,
      projects.map((one) => one.key),
    ),
  };
};

const of = defineCachedFunction(write, { maxAge: 60, name: "desk-standing", getKey: () => "all" });

export const DeskStandings = { of };
