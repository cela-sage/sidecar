import z from "zod";
import { SidecarConfig } from "../../lib/sidecar/config.ts";
import { expandHome } from "../../lib/sidecar/paths.ts";
import type { Project } from "../../shared/types/task.ts";

const DEFAULTS: Project[] = [
  { key: "moneyfarm", name: "Moneyfarm", token: "MF", folder: "~/Notes/projects/Moneyfarm" },
  { key: "cela", name: "Cela", token: "Cela", folder: "~/Notes/projects/Cela" },
  { key: "nana", name: "Nana", token: "Nana", folder: "~/Notes/projects/Nanaco" },
  { key: "madong", name: "madong", token: "madong", folder: "~/Notes/projects/Madong" },
  { key: "meta", name: "meta", token: "meta", folder: "~/Notes" },
];

const text = z.string().min(1);
const Configured = z
  .array(z.object({ key: text, name: text, token: text, folder: text }))
  .min(1)
  .refine((list) => new Set(list.map((one) => one.key)).size === list.length);

const list = (): Project[] => {
  const configured = Configured.safeParse(SidecarConfig.read().projects);
  return (configured.success ? configured.data : DEFAULTS).map((one) => ({ ...one, folder: expandHome(one.folder) }));
};

export const Projects = { list };
