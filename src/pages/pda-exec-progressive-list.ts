export interface PdaExecProgressiveSlice<T> {
  rows: T[]
  visibleCount: number
  total: number
  batchSize: number
  remainingCount: number
  hasMore: boolean
}

export type PdaExecProgressiveListKey = 'special-craft' | 'binding' | 'general'

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

export function renderPdaExecAutoLoadSentinel(
  slice: PdaExecProgressiveSlice<unknown>,
  listKey: PdaExecProgressiveListKey,
): string {
  if (!slice.hasMore) return ''
  const nextVisibleCount = Math.min(slice.visibleCount + slice.batchSize, slice.total)
  return `
    <div
      class="h-px w-full"
      data-pda-exec-auto-load-sentinel="${listKey}"
      data-list-key="${listKey}"
      data-next-visible-count="${nextVisibleCount}"
      aria-hidden="true"
    ></div>`
}
