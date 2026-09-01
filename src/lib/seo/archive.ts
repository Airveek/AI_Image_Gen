export function parseArchivePage(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

export function archivePagePath(rootPath: string, page: number): string {
  return page <= 1 ? rootPath : `${rootPath}/page/${page}`;
}
