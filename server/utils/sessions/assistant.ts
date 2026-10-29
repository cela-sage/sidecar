import { homedir } from "node:os";
import z from "zod";
import { SidecarConfig } from "../../../lib/sidecar/config.ts";
import type { Started } from "../../../shared/types/assistant.ts";
import { Projects } from "../projects.ts";
import { TaskLane } from "../tasks/lane.ts";
import { Roles } from "./roles.ts";

export interface StartInput {
  text: string;
  slug?: string;
}

const Settings = z.object({
  agent: z.string().min(1).optional(),
  project: z.string().min(1).default("meta"),
});

const settings = (): z.infer<typeof Settings> => {
  const parsed = Settings.safeParse(SidecarConfig.read().assistant ?? {});
  return parsed.success ? parsed.data : Settings.parse({});
};

const start = async ({ text, slug }: StartInput): Promise<Started> => {
  const { agent = Roles.agentOf("EA"), project } = settings();
  const home = Projects.find(project);
  const prompt = slug ? `While reading the task ${slug}:\n\n${text}` : text;
  const ran = await Roles.launch({ agent, cwd: home?.folder ?? homedir(), prompt });
  if ("failed" in ran) return { started: false, reason: ran.failed };
  if (slug)
    TaskLane.heard({ caller: { who: "YOU", from: `[${home?.token ?? project}] EA` }, kind: "message", text, slug });
  return { started: true, ...(ran.key ? { key: ran.key } : {}) };
};

export const Assistant = { start };
