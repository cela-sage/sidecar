import { parseArgs } from "node:util";
import * as Events from "../lib/sidecar/events.ts";
import { Projects } from "../server/utils/projects.ts";
import { RunConfigs } from "../server/utils/runs/configs.ts";

export const RUN_USAGE = `usage: sidecar run <project> [add|remove ...]
  (no verb)                          list the project's run configurations, by repo and source
  add "<name>" "<command>" [--folder <dir>]
                                     add one to the project's own, run in --folder, relative to the
                                     project's folder, or in the project's folder itself
  remove "<name>"                    remove one of the project's own`;

const list = (key: string): number => {
  const project = Projects.find(key);
  if (!project) return (console.error(`sidecar run: no project '${key}'`), 1);
  for (const group of RunConfigs.groupsOf(project)) {
    console.log(group.repo ? `${group.repo} · ${group.source}` : group.source);
    for (const one of group.configs) console.log(`  ${one.name.padEnd(24)} ${one.shown}`);
  }
  return 0;
};

const run = (args: string[]): number => {
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options: { folder: { type: "string" } } });
  const [key, verb, name, command] = positionals;
  if (!key) return (console.log(RUN_USAGE), 0);
  if (!verb) return list(key);
  if (!Projects.find(key)) return (console.error(`sidecar run: no project '${key}'`), 1);
  if (verb === "add" && name && command) RunConfigs.write(key, { name, command, folder: values.folder });
  else if (verb === "remove" && name) {
    if (!RunConfigs.remove(key, name)) return (console.error(`sidecar run: ${key} has no '${name}' of its own`), 1);
  } else return (console.error(RUN_USAGE), 2);
  Events.publish({ topic: "runs.changed", key: "", data: { project: key } });
  console.log(verb === "add" ? `added ${name} to ${key}` : `removed ${name} from ${key}`);
  return 0;
};

export const RunCommand = { run };
