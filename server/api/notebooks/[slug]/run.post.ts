import z from "zod";
import { Notebooks } from "~~/server/utils/notebooks";

const Body = z.object({ cells: z.array(z.string()).optional() });

export default defineEventHandler(async (event): Promise<void> => {
  const path = await Notebooks.pathOf(event);
  const body = Body.safeParse((await readBody(event)) ?? {});
  if (!body.success) throw createError({ statusCode: 400, statusMessage: "cells must be a list of cell ids" });
  await Notebooks.runs.run(path, body.data.cells);
});
