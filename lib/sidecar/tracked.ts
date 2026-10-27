import { mkdirSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { FileKind } from "../../shared/utils/file-kind.ts";
import { readTextSafe } from "../files.ts";
import { ArtifactLists } from "./lists.ts";
import { Sidecar, plansHome } from "./paths.ts";
import { documentSlug } from "./comments.ts";

const listPath = (): string => join(Sidecar.home(), "tracked.json");

function read(): Record<string, string> {
  try {
    const raw: unknown = JSON.parse(readTextSafe(listPath()) ?? "{}");
    if (typeof raw !== "object" || !raw) return {};
    return Object.fromEntries(
      Object.entries(raw).filter((pair): pair is [string, string] => typeof pair[1] === "string"),
    );
  } catch {
    return {};
  }
}

function write(all: Record<string, string>): void {
  mkdirSync(dirname(listPath()), { recursive: true });
  const tmp = `${listPath()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(all, undefined, 2)}\n`);
  renameSync(tmp, listPath());
}

// The path is real, so a folder reached through a symlink must be compared real too.
function isIn(path: string, folder: string): boolean {
  try {
    return dirname(path) === realpathSync(folder);
  } catch {
    return false;
  }
}

const isPage = (path: string): boolean => isIn(path, Sidecar.artifacts()) && /\.(html|ipynb|md)$/i.test(path);

// A local file a link opened, kept by its document slug so the sidecar serves only paths someone chose to open.
export const Tracked = {
  // A page or plan already has its entry, so only a file from anywhere else is tracked under a slug of its own.
  enter(path: string, key?: string): string {
    if (isPage(path)) {
      const slug = basename(path, extname(path));
      if (key) ArtifactLists.record(slug, key);
      return slug;
    }
    if (isIn(path, plansHome())) {
      if (key) ArtifactLists.record(path, key);
      return documentSlug(path);
    }
    const slug = Tracked.track(path);
    if (key) ArtifactLists.record(slug, key);
    return slug;
  },

  isTrackable: (path: string): boolean => !!FileKind.of(path),

  paths(): Map<string, string> {
    return new Map(Object.entries(read()));
  },

  track(path: string): string {
    const slug = documentSlug(path);
    const all = read();
    if (all[slug] !== path) write({ ...all, [slug]: path });
    return slug;
  },

  untrack(slug: string): string | undefined {
    const { [slug]: path, ...rest } = read();
    if (path) write(rest);
    return path;
  },
};
