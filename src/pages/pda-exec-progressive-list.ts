export interface PdaExecProgressiveSlice<T> {
  rows: T[]
  visibleCount: number
  total: number
  batchSize: number
  remainingCount: number
  hasMore: boolean
}

export function buildPdaExecProgressiveSlice<T>(
  rows: T[],
  requestedVisibleCount: number,
  batchSize: number,
): PdaExecProgressiveSlice<T> {
  const safeBatchSize = Math.max(1, Math.floor(batchSize))
  const total = rows.length
  const visibleCount = total === 0
    ? 0
    : Math.min(Math.max(Math.floor(requestedVisibleCount), safeBatchSize), total)
  const remainingCount = Math.max(total - visibleCount, 0)
  return {
    rows: rows.slice(0, visibleCount),
    visibleCount,
    total,
    batchSize: safeBatchSize,
    remainingCount,
    hasMore: remainingCount > 0,
  }
}

export function renderPdaExecLoadMoreControl(
  slice: PdaExecProgressiveSlice<unknown>,
  listKey: 'special-craft' | 'binding' | 'general',
): string {
  if (!slice.hasMore) return ''
  const nextVisibleCount = Math.min(slice.visibleCount + slice.batchSize, slice.total)
  const nextBatchCount = nextVisibleCount - slice.visibleCount
  return `
    <div class="space-y-2 rounded-lg border bg-card px-3 py-3 text-xs" data-pda-exec-load-more="${listKey}">
      <div class="text-center text-muted-foreground">已显示 ${slice.visibleCount} / ${slice.total} 条</div>
      <button
        type="button"
        class="h-10 w-full rounded-md border border-primary/40 bg-primary/5 font-medium text-primary"
        data-pda-exec-action="load-more"
        data-list-key="${listKey}"
        data-next-visible-count="${nextVisibleCount}"
        data-skip-page-rerender="true"
      >继续显示 ${nextBatchCount} 条</button>
    </div>`
}
