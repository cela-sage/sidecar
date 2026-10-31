const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SAVED = /\/sidecar\/uploads\/([^/]+)\/([^/]+)$/;

const isSafe = (segment: string): boolean => SAFE.test(segment);

const srcOf = (path: string): string | undefined => {
  const [, slug = "", name = ""] = SAVED.exec(path) ?? [];
  return isSafe(slug) && isSafe(name) ? `/uploads/${slug}/${name}` : undefined;
};

export const UploadedFiles = { isSafe, srcOf };
