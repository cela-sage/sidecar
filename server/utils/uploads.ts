import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Sidecar } from "../../lib/sidecar/paths.ts";
import type { ArtifactUpload } from "../../shared/types/artifact.ts";

const EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const LINK = "../uploads/";
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const maxBytes = 20 * 1024 * 1024;

const extensionOf = (contentType: string | undefined): string | undefined =>
  EXTENSIONS[(contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? ""];

const isSafe = (segment: string): boolean => SAFE.test(segment);

const pathOf = ({ name, slug }: { name: string; slug: string }): string | undefined =>
  isSafe(slug) && isSafe(name) ? join(Sidecar.uploads(), slug, name) : undefined;

const isLink = (src: string): boolean => src.startsWith(LINK);

const pad = (n: number): string => String(n).padStart(2, "0");

const isTaken = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "EEXIST";

// The link is relative on purpose: it resolves on disk from the artifacts folder and in the browser from /artifact/<slug>.
const save = async ({ bytes, extension, now = new Date(), slug }: Uploads.Save): Promise<ArtifactUpload> => {
  const dir = join(Sidecar.uploads(), slug);
  await mkdir(dir, { recursive: true });
  const stamp = `pasted-${pad(now.getHours())}${pad(now.getMinutes())}`;
  for (let n = 1; ; n++) {
    const name = `${n > 1 ? `${stamp}-${n}` : stamp}.${extension}`;
    try {
      await writeFile(join(dir, name), bytes, { flag: "wx" });
      return { name, link: `${LINK}${slug}/${name}` };
    } catch (error) {
      if (!isTaken(error)) throw error;
    }
  }
};

export const Uploads = { extensionOf, isLink, isSafe, maxBytes, pathOf, save };

export namespace Uploads {
  export interface Save {
    bytes: Buffer;
    extension: string;
    now?: Date;
    slug: string;
  }
}
