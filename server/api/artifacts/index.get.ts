import { listArtifacts } from "../../utils/artifacts";
import { TaskShelf } from "../../utils/tasks/shelf";
import type { ArtifactMeta } from "../../../shared/types/artifact";

export default defineEventHandler(async (): Promise<ArtifactMeta[]> => {
  return TaskShelf.mark(await listArtifacts());
});
