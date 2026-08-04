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
  type PickupSupplementRecordFactInput,
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
  ensureFixedSupplementOrderFixturesRegistered,
} from '../../../data/fcs/cutting/cut-order-supplement-fixture.ts'
import {
  listSupplementOrders,
  type SupplementOrderLifecycle,
} from '../../../data/fcs/cutting/supplement-order-registry.ts'
import { assertPickupNodeHasNoOpenDiscrepancy } from '../../../data/fcs/cutting/pickup-discrepancy.ts'

export const PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY = 'pickupWarehouseTransaction'

export function toPickupSupplementRecordFactInputs(
  records: SupplementOrderLifecycle[],
): PickupSupplementRecordFactInput[] {
  return records.map((record) => ({
    id: record.id,
    materialPrepDemandId: record.materialPrepDemandId,
    recordNo: record.recordNo,
    status: record.status,
    createdAt: record.createdAt,
    draft: {
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      reason: record.reason,
      reasonDetail: record.reasonDetail,
      materialDemands: [...record.materialDemands],
    },
    processWorkOrderRefs: record.processWorkOrderRefs.map((ref) => ({
      ...ref,
      materialDemandIds: [...ref.materialDemandIds],
    })),
  }))
}

interface PickupWarehouseTransactionJournal {
  status: 'PREPARING' | 'COMMITTED'
  createdAt: string
  prepBefore: string | null
  ledgerBefore: string | null
}

const PICKUP_WAREHOUSE_TRANSACTION_STALE_MS = 30_000

export interface PickupRuntimeOverrides {
  supplementRecords?: SupplementOrderLifecycle[]
  dyeResults?: PickupProcessResultFact[]
  printResults?: PickupProcessResultFact[]
}

export interface PickupRuntimeContext {
  projections: MaterialPrepOrderProjection[]
  supplementRecords: SupplementOrderLifecycle[]
  dyeResults: PickupProcessResultFact[]
  printResults: PickupProcessResultFact[]
  demandFacts: PickupDemandFact[]
  activeNodes: PickupNodeProjection[]
}

export function bootstrapPickupManagementRuntimeMockData(): SupplementOrderLifecycle[] {
  ensureFixedSupplementOrderFixturesRegistered()
  return listSupplementOrders()
}

export function buildPickupRuntimeContext(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupRuntimeContext {
  recoverPendingPickupWarehouseTransaction(storage)
  const projections = listMaterialPrepOrderProjections(storage)
  const supplementRecords = overrides.supplementRecords ?? listSupplementOrders()
  const dyeResults = overrides.dyeResults ?? listPlatformDyeResultViews()
  const printResults = overrides.printResults ?? listPlatformPrintResultViews()
  const demandFacts = buildPickupDemandFactsFromProjections({
    projections,
    supplementRecords: toPickupSupplementRecordFactInputs(supplementRecords),
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

export function recoverPendingPickupWarehouseTransaction(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): void {
  const raw = storage?.getItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY)
  if (!raw || !storage?.setItem || !storage.removeItem) return
  let journal: PickupWarehouseTransactionJournal
  try {
    journal = JSON.parse(raw) as PickupWarehouseTransactionJournal
  } catch {
    throw new Error('领料原子事务日志损坏，请联系系统管理员处理。')
  }
  if (
    (journal.status !== 'PREPARING' && journal.status !== 'COMMITTED')
    || !journal.createdAt
    || !Number.isFinite(Date.parse(journal.createdAt))
    || (journal.prepBefore !== null && typeof journal.prepBefore !== 'string')
    || (journal.ledgerBefore !== null && typeof journal.ledgerBefore !== 'string')
  ) {
    throw new Error('领料原子事务日志格式无效，请联系系统管理员处理。')
  }
  if (journal.status === 'PREPARING') {
    if (Date.now() - Date.parse(journal.createdAt) < PICKUP_WAREHOUSE_TRANSACTION_STALE_MS) {
      throw new Error('领料确认正在提交，请稍后重试。')
    }
    restoreStorageValue(storage, PRODUCTION_MATERIAL_PREP_STORAGE_KEY, journal.prepBefore)
    restoreStorageValue(storage, CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, journal.ledgerBefore)
    invalidateMaterialPrepProjectionCache()
  }
  storage.removeItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY)
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
  recoverPendingPickupWarehouseTransaction(storage)
  assertPickupNodeHasNoOpenDiscrepancy(input.pickupNodeId, input.pickupNodeVersion, storage)
  const context = buildPickupRuntimeContext(storage, overrides)
  const prepBefore = storage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
  const ledgerBefore = storage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
  const journal: PickupWarehouseTransactionJournal = {
    status: 'PREPARING',
    createdAt: new Date().toISOString(),
    prepBefore,
    ledgerBefore,
  }
  storage.setItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY, JSON.stringify(journal))
  try {
    const session = appendPickupSessionFromNode({
      ...input,
      warehouseSyncDeferred: false,
    }, storage, context.demandFacts)
    writeWarehouseFacts(session, storage)
    storage.setItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY, JSON.stringify({
      ...journal,
      status: 'COMMITTED',
    }))
    storage.removeItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY)
    return session
  } catch (error) {
    restoreStorageValue(storage, PRODUCTION_MATERIAL_PREP_STORAGE_KEY, prepBefore)
    restoreStorageValue(storage, CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, ledgerBefore)
    storage.removeItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY)
    invalidateMaterialPrepProjectionCache()
    throw error
  }
}
