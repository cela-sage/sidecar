import z from "zod";
import { Reach } from "~~/lib/web/reach";
import { reachOf } from "~~/server/utils/web/proxy";
import { linkPreview } from "~~/server/utils/web/preview";
import type { LinkPreview } from "~~/shared/types/web";

const Query = z.object({ from: z.url().optional(), url: z.url({ protocol: /^https?$/ }) });

// A remote page's link to this machine is never looked up, the line Chrome's Private Network Access draws.
export default defineEventHandler(async (event): Promise<LinkPreview> => {
  const query = Query.safeParse(getQuery(event)).data;
  if (!query) throw createError({ statusCode: 400, statusMessage: "give the link's http or https address" });
  const url = new URL(query.url);
  if (query.from) {
    const [to, from] = await Promise.all([reachOf(url.hostname), reachOf(new URL(query.from).hostname)]);
    if (Reach.rank[to] > Reach.rank[from])
      throw createError({
        statusCode: 403,
        statusMessage: "a page reaches no host closer to this machine than its own",
      });
  }
  const preview = await linkPreview({ url, userAgent: getRequestHeader(event, "user-agent") });
  if (!preview) throw createError({ statusCode: 404, statusMessage: `nothing to preview at ${url.host}` });
  setResponseHeader(event, "cache-control", "max-age=600");
  return preview;
});
