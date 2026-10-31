import { listArtifacts } from "../../utils/artifacts";
import type { ArtifactMeta } from "../../../shared/types/artifact";

export default defineEventHandler((): Promise<ArtifactMeta[]> => listArtifacts());
