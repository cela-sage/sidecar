import { EventListeners } from "~~/server/utils/listeners";

export default defineEventHandler((): { listeners: number } => ({ listeners: EventListeners.count() }));
