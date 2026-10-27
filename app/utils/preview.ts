import { FileKind } from "~~/shared/utils/file-kind";

// How far along each axis a pane is scrolled, 0 to 1, so two panes of different lengths still line up.
export interface PreviewScroll {
  x: number;
  y: number;
}

export interface PreviewSrcOptions {
  conversation: string;
  path: string;
  version?: string;
  isOriginal?: boolean;
}

const TEXT = new Set(["htm", "html", "ipynb", "markdown", "md", "svg"]);
const ZOOMABLE = new Set<FileKind>(["image", "markdown", "notebook", "page", "video"]);
const RENDERED = new Set<FileKind>(["markdown", "notebook"]);

// Text the editor opens as well, so the face offers the code beside the rendering.
function isText(path: string): boolean {
  return TEXT.has(FileKind.extensionOf(path));
}

// A PDF and an audio file come with their own controls.
function isZoomable(kind: FileKind): boolean {
  return ZOOMABLE.has(kind);
}

// Each segment encoded on its own, so the route keeps the file's folder and a page's relative assets resolve beside it.
function srcOf({ conversation, path, version, isOriginal = false }: PreviewSrcOptions): string {
  const route = isOriginal ? "review/original" : "files/raw";
  const query = new URLSearchParams();
  const kind = FileKind.of(path);
  if (kind && RENDERED.has(kind)) query.set("as", "page");
  if (version) query.set("v", version);
  return `/api/sessions/${encodeURIComponent(conversation)}/${route}${path.split("/").map(encodeURIComponent).join("/")}?${query}`;
}

export const Preview = { isText, isZoomable, kindOf: FileKind.of, srcOf };
