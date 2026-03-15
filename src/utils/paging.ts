export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50] as const

export interface PagingResult<T> {
  rows: T[]
  total: number
  totalPages: number
  currentPage: number
  from: number
  to: number
}

export function parsePageSize(
  value: string | number,
  options: readonly number[] = DEFAULT_PAGE_SIZE_OPTIONS,
  fallback = 10,
): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const integer = Math.trunc(parsed)
  if (integer <= 0) return fallback
  return options.includes(integer) ? integer : fallback
}

export function getTotalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
}

export function clampPage(currentPage: number, totalPages: number): number {
  if (!Number.isFinite(currentPage)) return 1
  return Math.min(Math.max(1, Math.trunc(currentPage)), Math.max(1, totalPages))
}

export function paginateRows<T>(rows: T[], currentPage: number, pageSize: number): PagingResult<T> {
  const safePageSize = Math.max(1, Math.trunc(pageSize) || 1)
  const total = rows.length
  const totalPages = getTotalPages(total, safePageSize)
  const safeCurrentPage = clampPage(currentPage, totalPages)
  const start = (safeCurrentPage - 1) * safePageSize
  const end = start + safePageSize

  return {
    rows: rows.slice(start, end),
    total,
    totalPages,
    currentPage: safeCurrentPage,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : Math.min(end, total),
  }
}

export function getPrevPage(currentPage: number): number {
  return Math.max(1, Math.trunc(currentPage || 1) - 1)
}

export function getNextPage(currentPage: number, total: number, pageSize: number): number {
  const totalPages = getTotalPages(total, pageSize)
  return Math.min(totalPages, clampPage(currentPage, totalPages) + 1)
}
