import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../../data/browser-storage.ts'
import {
  appendPickupSessionFromNode,
  buildPickupDemandFactsFromProjections,
  invalidateMaterialPrepProjectionCache,
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  type MaterialPrepOrderProjection,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY } from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type {
  PickupDemandFact,
  PickupProcessResultFact,
} from '../../../data/fcs/cutting/pickup-demand-domain.ts'
import type {
  PickupNodeProjection,
  PickupSession,
} from '../../../data/fcs/cutting/pickup-node-domain.ts'
import {
  listPlatformDyeResultViews,
  listPlatformPrintResultViews,
} from '../../../data/fcs/platform-process-result-view.ts'
import {
  ensureSupplementRecordPickupSeeds,
  listSupplementRecords,
  type SupplementRecord,
} from '../../../data/fcs/cutting/supplement-records.ts'
import { assertPickupNodeHasNoOpenDiscrepancy } from '../../../data/fcs/cutting/pickup-discrepancy.ts'

export interface PickupRuntimeOverrides {
  supplementRecords?: SupplementRecord[]
  dyeResults?: PickupProcessResultFact[]
  printResults?: PickupProcessResultFact[]
}

export interface PickupRuntimeContext {
  projections: MaterialPrepOrderProjection[]
  supplementRecords: SupplementRecord[]
  dyeResults: PickupProcessResultFact[]
  printResults: PickupProcessResultFact[]
  demandFacts: PickupDemandFact[]
  activeNodes: PickupNodeProjection[]
}

export function bootstrapPickupManagementRuntimeMockData(): SupplementRecord[] {
  return ensureSupplementRecordPickupSeeds()
}

export function buildPickupRuntimeContext(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupRuntimeContext {
  const projections = listMaterialPrepOrderProjections(storage)
  const supplementRecords = overrides.supplementRecords ?? listSupplementRecords()
  const dyeResults = overrides.dyeResults ?? listPlatformDyeResultViews()
  const printResults = overrides.printResults ?? listPlatformPrintResultViews()
  const demandFacts = buildPickupDemandFactsFromProjections({
    projections,
    supplementRecords,
    dyeResults,
    printResults,
  })
  return {
    projections,
    supplementRecords,
    dyeResults,
    printResults,
    demandFacts,
    activeNodes: listActivePickupNodes(storage, demandFacts),
  }
}

export function listPickupDemandFactsRuntime(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupDemandFact[] {
  return buildPickupRuntimeContext(storage, overrides).demandFacts
}

export function listActivePickupNodesRuntime(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupNodeProjection[] {
  return buildPickupRuntimeContext(storage, overrides).activeNodes
}

export function appendPickupSessionFromNodeRuntime(
  input: Parameters<typeof appendPickupSessionFromNode>[0],
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupSession {
  assertPickupNodeHasNoOpenDiscrepancy(input.pickupNodeId, input.pickupNodeVersion, storage)
  const context = buildPickupRuntimeContext(storage, overrides)
  return appendPickupSessionFromNode(input, storage, context.demandFacts)
}

function restoreStorageValue(
  storage: BrowserStorageLike,
  key: string,
  value: string | null,
): void {
  if (value === null) storage.removeItem?.(key)
  else storage.setItem?.(key, value)
}

/**
 * 原型内的跨事实原子边界：领料会话/明细与裁床待加工仓流水要么共同写入，
 * 要么恢复确认前的两份本地事实，不能留下“领料已保存、流水待重试”的中间态。
 */
export function appendPickupSessionWithWarehouseFactsRuntime(
  input: Omit<Parameters<typeof appendPickupSessionFromNode>[0], 'warehouseSyncDeferred'>,
  writeWarehouseFacts: (
    session: PickupSession,
    storage: BrowserStorageLike | null,
  ) => void,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupSession {
  if (!storage?.setItem || !storage.removeItem) {
    throw new Error('当前存储不支持原子领料确认，请刷新后重试。')
  }
  const prepBefore = storage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
  const ledgerBefore = storage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
  try {
    const session = appendPickupSessionFromNodeRuntime({
      ...input,
      warehouseSyncDeferred: false,
    }, storage, overrides)
    writeWarehouseFacts(session, storage)
    return session
  } catch (error) {
    restoreStorageValue(storage, PRODUCTION_MATERIAL_PREP_STORAGE_KEY, prepBefore)
    restoreStorageValue(storage, CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, ledgerBefore)
    invalidateMaterialPrepProjectionCache()
    throw error
  }
}
