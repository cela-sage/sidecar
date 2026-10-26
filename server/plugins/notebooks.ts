import { Notebooks } from "~~/server/utils/notebooks";
import { Watched } from "~~/server/utils/watched";

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("close", async () => {
    await Promise.all([Notebooks.runs.stopAll(), Watched.close()]);
  });
});
