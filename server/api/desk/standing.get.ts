import { Desk } from "~~/server/utils/desk";
import type { DeskStanding } from "~~/shared/types/desk";

export default defineEventHandler((): Promise<DeskStanding | undefined> =>
  Desk.standing().catch((error: unknown) => {
    console.error(`sidecar: no desk standing: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }),
);
