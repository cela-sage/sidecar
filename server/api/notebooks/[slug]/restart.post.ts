import { Notebooks } from "~~/server/utils/notebooks";

export default defineEventHandler(async (event): Promise<void> =>
  Notebooks.runs.restart(await Notebooks.pathOf(event)),
);
