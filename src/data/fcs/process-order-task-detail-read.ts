import { getDesignRevisionFcsStorage, hasDesignRevisionFcsCacheOwner } from './design-revision-pcs-storage.ts'
import { PRINT_EXECUTION_STORAGE_KEY, DYE_EXECUTION_STORAGE_KEY } from './process-execution-storage-keys.ts'
import type { ProcessOrderTaskSourceReader } from './process-order-task-link-core.ts'
import { listWaterSolubleRelationSources } from './water-soluble-relation-sources.ts'

const completeSourceRequired = Symbol('complete process relation source required')

// This reader is only used synchronously inside the detail callback below. The
// core supplies its original route codes, including undefined for unscoped reads.
const readUninitializedDetailSources: ProcessOrderTaskSourceReader = (routeCodes) => {
  if (!routeCodes || routeCodes.has('PRINT') || routeCodes.has('DYE')
    || hasDesignRevisionFcsCacheOwner('print') || hasDesignRevisionFcsCacheOwner('dye')) {
    throw completeSourceRequired
  }
  if (typeof window !== 'undefined' || typeof localStorage !== 'undefined') {
    // Effective storage includes PCS overlays and the washing bridge. A real
    // probe error propagates unchanged; it is never an empty-source fallback.
    if (getDesignRevisionFcsStorage().getItem(PRINT_EXECUTION_STORAGE_KEY) !== null
      || getDesignRevisionFcsStorage().getItem(DYE_EXECUTION_STORAGE_KEY) !== null) {
      throw completeSourceRequired
    }
  }
  return listWaterSolubleRelationSources().sort((left, right) => left.workOrderNo.localeCompare(right.workOrderNo))
}

export async function readPreparedProcessOrderTaskDetail(read: (readSources: ProcessOrderTaskSourceReader) => string): Promise<string> {
  try { return read(readUninitializedDetailSources) }
  catch (error) {
    if (error !== completeSourceRequired) throw error
  }
  // Vite can fulfill an import with undefined after the app schedules a reload
  // and prevents its preload error. Keep that original error instead of creating
  // a secondary destructuring error while recovery is already in progress.
  const preloadTarget = typeof window === 'undefined' ? undefined : window
  let preloadFailure: unknown
  const rememberPreloadFailure = (event: Event) => {
    const failure = event as Event & { payload?: unknown; detail?: unknown }
    preloadFailure = failure.payload ?? failure.detail ?? event
  }
  preloadTarget?.addEventListener('vite:preloadError', rememberPreloadFailure)
  try {
    const owner = await import('./process-work-order-domain.ts')
    if (!owner || typeof owner.listProcessWorkOrderRelationSources !== 'function') {
      throw preloadFailure ?? new Error('加工单关联资料未加载，请刷新页面后重试。')
    }
    // Re-read the current task, guards and scope after import, in one synchronous
    // callback. No narrow reader or prior view is retained across the await.
    return read(owner.listProcessWorkOrderRelationSources)
  } finally {
    preloadTarget?.removeEventListener('vite:preloadError', rememberPreloadFailure)
  }
}
