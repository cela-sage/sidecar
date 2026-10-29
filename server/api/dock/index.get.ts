import { DockTabs } from "~~/server/utils/dock/tabs";
import type { DockTab } from "~~/shared/types/dock";

export default defineEventHandler((): DockTab[] => DockTabs.list());
