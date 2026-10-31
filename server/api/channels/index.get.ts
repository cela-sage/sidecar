import { Channels } from "~~/server/utils/channels";

export default defineEventHandler((): Record<string, { raised: number }> => Channels.summary());
