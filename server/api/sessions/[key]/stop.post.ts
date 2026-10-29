import { deliver, type DeliverResult } from "~~/server/utils/sessions/inbox";

// The mod reads the bare action under the [[sidecar]] marker as its own, so Claude never sees it.
export default defineEventHandler((event): Promise<DeliverResult> => {
  const key = getRouterParam(event, "key") || "";
  return deliver({ key, text: JSON.stringify({ do: "stop" }), canWake: false });
});
