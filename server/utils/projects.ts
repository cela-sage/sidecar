import z from "zod";
import { SidecarConfig } from "../../lib/sidecar/config.ts";
import { expandHome } from "../../lib/sidecar/paths.ts";
import type { Project } from "../../shared/types/task.ts";

const DEFAULTS: Project[] = [
  {
    key: "moneyfarm",
    name: "Moneyfarm",
    token: "MF",
    folder: "~/Notes/projects/Moneyfarm",
    image: "~/Notes/projects/Moneyfarm/mf-app/public/apple-touch-icon.png",
  },
  {
    key: "cela",
    name: "Cela",
    token: "Cela",
    folder: "~/Notes/projects/Cela",
    image: "~/Notes/projects/Cela/cela/public/brand/cela-static.svg",
  },
  { key: "nana", name: "Nana", token: "Nana", folder: "~/Notes/projects/Nanaco", icon: "💞" },
  {
    key: "madong",
    name: "madong",
    token: "madong",
    folder: "~/Notes/projects/Madong",
    image: "~/Notes/projects/Madong/portfolio/public/favicon.svg",
  },
  { key: "meta", name: "meta", token: "meta", folder: "~/Notes", icon: "⚙️" },
];

const text = z.string().min(1);
const Configured = z
  .array(z.object({ key: text, name: text, token: text, folder: text, icon: text.optional(), image: text.optional() }))
  .min(1)
  .refine((list) => new Set(list.map((one) => one.key)).size === list.length);

const list = (): Project[] => {
  const configured = Configured.safeParse(SidecarConfig.read().projects);
  return (configured.success ? configured.data : DEFAULTS).map(({ image, ...one }) => ({
    ...one,
    folder: expandHome(one.folder),
    ...(image ? { image: expandHome(image) } : {}),
  }));
};

const find = (key: string | undefined): Project | undefined => list().find((one) => one.key === key);

export const Projects = { find, list };
