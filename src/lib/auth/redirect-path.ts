const DEFAULT_REDIRECT_PATH = "/dashboard";

export function getSafeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_REDIRECT_PATH;
  }

  return value;
}

export function getPathWithNext(path: string, nextPath: string): string {
  if (nextPath === DEFAULT_REDIRECT_PATH) {
    return path;
  }

  return `${path}?next=${encodeURIComponent(nextPath)}`;
}
