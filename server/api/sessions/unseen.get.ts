import { Seen } from "~~/server/utils/sessions/seen";

export default defineEventHandler((): Record<string, number> => Seen.snapshot());
