export type FileKind = "audio" | "image" | "markdown" | "notebook" | "page" | "pdf" | "video";

// What Chrome draws natively, so a tiff or a heic never offers a preview that comes up blank.
const EXTENSIONS: Record<FileKind, readonly string[]> = {
  audio: ["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav"],
  image: ["apng", "avif", "bmp", "gif", "ico", "jpeg", "jpg", "png", "svg", "webp"],
  markdown: ["markdown", "md"],
  notebook: ["ipynb"],
  page: ["htm", "html"],
  pdf: ["pdf"],
  video: ["m4v", "mov", "mp4", "ogv", "webm"],
};

const KIND_OF = new Map(
  (Object.entries(EXTENSIONS) as [FileKind, readonly string[]][]).flatMap(([kind, list]) =>
    list.map((extension) => [extension, kind] as const),
  ),
);

const extensionOf = (path: string): string => {
  const name = path.split("/").pop() ?? "";
  return name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
};

const of = (path: string): FileKind | undefined => KIND_OF.get(extensionOf(path));

export const FileKind = { extensionOf, of };
