import { UsageStore } from "~~/server/utils/sessions/usage";
import type { RateLimit } from "~~/shared/types/usage";

export default defineEventHandler((): { rateLimits: RateLimit[] } => ({ rateLimits: UsageStore.plan() }));
