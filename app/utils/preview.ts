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
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

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

function step(zoom: number, way: 1 | -1): number {
  const next = way > 0 ? STEPS.find((one) => one > zoom + 0.001) : STEPS.findLast((one) => one < zoom - 0.001);
  return next ?? zoom;
}

function clamp(zoom: number): number {
  return Math.min(STEPS.at(-1) ?? zoom, Math.max(STEPS[0] ?? zoom, zoom));
}

// A mouse notch arrives as a hundred pixels and a pinch as a few, so one notch is capped near a quarter.
function pinch(zoom: number, deltaY: number): number {
  return clamp(zoom * Math.exp(-Math.max(-30, Math.min(30, deltaY)) / 100));
}

export const Preview = { clamp, isText, isZoomable, kindOf: FileKind.of, pinch, srcOf, step };
