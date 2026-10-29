export const isOwnOrigin = (host: string, origin?: string): boolean => {
  if (!origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};
