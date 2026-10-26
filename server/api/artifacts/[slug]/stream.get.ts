import { contentSignature, readArtifact } from "~~/server/utils/artifacts";
import { Watched } from "~~/server/utils/watched";

// `ready` carries what the file is now, so a reader that reconnects after a change it missed still reloads.
export default defineEventHandler(async (event): Promise<void> => {
  const slug = getRouterParam(event, "slug") ?? "";
  const source = await readArtifact(slug);
  if (!source || source.kind === "web")
    throw createError({ statusCode: 404, statusMessage: `no file matching '${slug}'` });
  const stream = createEventStream(event);
  const signature = (): Promise<string> => contentSignature(source).catch(() => "");
  let last = await signature();
  const release = Watched.hold(source.path, async ({ isOwn }) => {
    const hash = await signature();
    if (!hash || hash === last) return;
    last = hash;
    if (!isOwn) void stream.push({ data: JSON.stringify({ hash }), event: "changed" });
  });
  stream.onClosed(release);
  void stream.push({ data: JSON.stringify({ hash: last }), event: "ready" });
  return stream.send();
});
