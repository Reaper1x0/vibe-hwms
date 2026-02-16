export const DEFAULT_PAGE_SIZE = 5;

export const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

export type RowsPerPage = (typeof ROWS_PER_PAGE_OPTIONS)[number];

export function parseLimit(value: string | undefined): number {
  const n = parseInt(String(value ?? ""), 10);
  if (ROWS_PER_PAGE_OPTIONS.includes(n as RowsPerPage)) {
    return n;
  }
  return DEFAULT_PAGE_SIZE;
}
