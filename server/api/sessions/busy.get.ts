import { TurnBus } from "~~/server/utils/sessions/busy";
import type { Busy } from "~~/shared/utils/busy";

export default defineEventHandler((): Record<string, Busy> => TurnBus.snapshot());
