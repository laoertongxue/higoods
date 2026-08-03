export interface PdaExecPageSlice<T> {
  rows: T[]
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
}

export function buildPdaExecPageSlice<T>(
  rows: T[],
  requestedPage: number,
  pageSize: number,
): PdaExecPageSlice<T> {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages)
  return {
    rows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    currentPage,
    totalPages,
    total,
    pageSize,
  }
}

export function renderPdaExecPaginationControls(page: PdaExecPageSlice<unknown>): string {
  return `
    <div class="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs" data-pda-exec-pagination>
      <button type="button" class="rounded border px-3 py-1 disabled:opacity-50" data-pda-exec-action="page" data-page="${page.currentPage - 1}" data-skip-page-rerender="true" ${page.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span>第 ${page.currentPage} / ${page.totalPages} 页，每页 ${page.pageSize} 条，共 ${page.total} 条</span>
      <button type="button" class="rounded border px-3 py-1 disabled:opacity-50" data-pda-exec-action="page" data-page="${page.currentPage + 1}" data-skip-page-rerender="true" ${page.currentPage >= page.totalPages ? 'disabled' : ''}>下一页</button>
    </div>`
}
