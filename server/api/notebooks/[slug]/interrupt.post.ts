import { Notebooks } from "~~/server/utils/notebooks";

export default defineEventHandler(async (event): Promise<void> =>
  Notebooks.runs.interrupt(await Notebooks.pathOf(event)),
);
