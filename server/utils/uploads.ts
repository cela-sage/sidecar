import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Sidecar } from "../../lib/sidecar/paths.ts";
import type { ArtifactUpload } from "../../shared/types/artifact.ts";
import type { AttachedFile } from "../../shared/types/files.ts";

const EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const LINK = "../uploads/";
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DOOR = "door";
const NAME_MAX = 120;

const maxBytes = 20 * 1024 * 1024;

const extensionOf = (contentType: string | undefined): string | undefined =>
  EXTENSIONS[(contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? ""];

const isSafe = (segment: string): boolean => SAFE.test(segment);

const pathOf = ({ name, slug }: { name: string; slug: string }): string | undefined =>
  isSafe(slug) && isSafe(name) ? join(Sidecar.uploads(), slug, name) : undefined;

const isLink = (src: string): boolean => src.startsWith(LINK);

const pad = (n: number): string => String(n).padStart(2, "0");

const isTaken = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "EEXIST";

const numbered = (name: string, n: number): string => {
  if (n === 1) return name;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`;
};

const claim = async ({ dir, name, bytes }: { dir: string; name: string; bytes: Buffer }): Promise<string> => {
  await mkdir(dir, { recursive: true });
  for (let n = 1; ; n++) {
    const path = join(dir, numbered(name, n));
    try {
      await writeFile(path, bytes, { flag: "wx" });
      return path;
    } catch (error) {
      if (!isTaken(error)) throw error;
    }
  }
};

const safeNameOf = (original: string): string => {
  const plain = (original.split(/[\\/]/).at(-1) ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const name = plain
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(-NAME_MAX);
  return isSafe(name) ? name : "file";
};

// The link is relative on purpose: it resolves on disk from the artifacts folder and in the browser from /artifact/<slug>.
const save = async ({ bytes, extension, now = new Date(), slug }: Uploads.Save): Promise<ArtifactUpload> => {
  const name = `pasted-${pad(now.getHours())}${pad(now.getMinutes())}.${extension}`;
  const path = await claim({ dir: join(Sidecar.uploads(), slug), name, bytes });
  return { name: basename(path), link: `${LINK}${slug}/${basename(path)}` };
};

const attach = async ({ bytes, name }: Uploads.Attach): Promise<AttachedFile> => {
  const path = await claim({ dir: join(Sidecar.uploads(), DOOR), name: safeNameOf(name), bytes });
  return { name: basename(path), path };
};

export const Uploads = { attach, extensionOf, isLink, isSafe, maxBytes, pathOf, safeNameOf, save };

export namespace Uploads {
  export interface Save {
    bytes: Buffer;
    extension: string;
    now?: Date;
    slug: string;
  }

  export interface Attach {
    bytes: Buffer;
    name: string;
  }
}
