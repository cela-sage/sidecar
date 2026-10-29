import z from "zod";
import { isOwnOrigin } from "~~/server/utils/dock/origin";
import { DockTabs, type DockViewer } from "~~/server/utils/dock/tabs";

const Size = z.object({ cols: z.number().int().min(2).max(500), rows: z.number().int().min(2).max(300) });
const Sent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("input"), data: z.string() }),
  Size.extend({ kind: z.literal("resize") }),
]);

const watching = new Map<string, { id: string; viewer: DockViewer }>();

const parsedJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export default defineWebSocketHandler({
  upgrade(request) {
    if (!isOwnOrigin(new URL(request.url).host, request.headers.get("origin") ?? undefined))
      throw new Response("only the sidecar's own page can open a terminal", { status: 403 });
  },

  open(peer) {
    const id = decodeURIComponent(new URL(peer.request.url).pathname.split("/").at(-1) ?? "");
    const viewer: DockViewer = { send: (data) => peer.send(data), close: (code, reason) => peer.close(code, reason) };
    if (!DockTabs.join(id, viewer)) return peer.close(1008, "no such terminal");
    watching.set(peer.id, { id, viewer });
  },

  message(peer, message) {
    const at = watching.get(peer.id);
    const sent = Sent.safeParse(parsedJson(message.text()));
    if (!at || !sent.success) return;
    if (sent.data.kind === "input") return DockTabs.write(at.id, sent.data.data);
    DockTabs.resize(at.id, sent.data);
  },

  close(peer) {
    const at = watching.get(peer.id);
    watching.delete(peer.id);
    if (at) DockTabs.leave(at.id, at.viewer);
  },
});
