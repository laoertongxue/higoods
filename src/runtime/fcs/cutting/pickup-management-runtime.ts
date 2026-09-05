import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../../data/browser-storage.ts'
import {
  appendPickupSessionFromNode,
  buildPickupDemandFactsFromProjections,
  getPickupSessionByNodeId,
  invalidateMaterialPrepProjectionCache,
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  recordPickupSessionWarehouseSyncResult,
  type MaterialPrepOrderProjection,
  type PickupSupplementRecordFactInput,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import {
  appendCuttingRuntimeEventIdempotent,
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  type CuttingRuntimeEventSource,
  type CuttingRuntimeQtyUnit,
} from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type {
  PickupDemandFact,
  PickupProcessResultFact,
} from '../../../data/fcs/cutting/pickup-demand-domain.ts'
import type {
  PickupNodeProjection,
  PickupSession,
  PickupStorageLocationRef,
} from '../../../data/fcs/cutting/pickup-node-domain.ts'
import {
  listPlatformDyeResultViews,
  listPlatformPrintResultViews,
} from '../../../data/fcs/platform-process-result-view.ts'
import {
  ensurePickupSeedSupplementFixturesRegistered,
} from '../../../data/fcs/cutting/cut-order-supplement-fixture.ts'
import {
  listSupplementOrders,
  type SupplementOrderLifecycle,
} from '../../../data/fcs/cutting/supplement-order-registry.ts'
import { assertPickupNodeHasNoOpenDiscrepancy } from '../../../data/fcs/cutting/pickup-discrepancy.ts'

export const PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY = 'pickupWarehouseTransaction'

export function toPickupSupplementRecordFactInputs(
  records: readonly SupplementOrderLifecycle[],
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
  ensurePickupSeedSupplementFixturesRegistered()
  return [...listSupplementOrders()]
}

export function buildPickupRuntimeContext(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupRuntimeContext {
  recoverPendingPickupWarehouseTransaction(storage)
  const projections = listMaterialPrepOrderProjections(storage)
  const supplementRecords = [...(overrides.supplementRecords ?? listSupplementOrders())]
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
    throw new Error('接收原子事务日志损坏，请联系系统管理员处理。')
  }
  if (
    (journal.status !== 'PREPARING' && journal.status !== 'COMMITTED')
    || !journal.createdAt
    || !Number.isFinite(Date.parse(journal.createdAt))
    || (journal.prepBefore !== null && typeof journal.prepBefore !== 'string')
    || (journal.ledgerBefore !== null && typeof journal.ledgerBefore !== 'string')
  ) {
    throw new Error('接收原子事务日志格式无效，请联系系统管理员处理。')
  }
  if (journal.status === 'PREPARING') {
    if (Date.now() - Date.parse(journal.createdAt) < PICKUP_WAREHOUSE_TRANSACTION_STALE_MS) {
      throw new Error('接收确认正在提交，请稍后重试。')
    }
    restoreStorageValue(storage, PRODUCTION_MATERIAL_PREP_STORAGE_KEY, journal.prepBefore)
    restoreStorageValue(storage, CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, journal.ledgerBefore)
    invalidateMaterialPrepProjectionCache()
  }
  storage.removeItem(PICKUP_WAREHOUSE_TRANSACTION_STORAGE_KEY)
}

/**
 * 原型内的跨事实原子边界：接收会话/明细与裁床待加工仓流水要么共同写入，
 * 要么恢复确认前的两份本地事实，不能留下“接收已保存、流水待重试”的中间态。
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
    throw new Error('当前存储不支持原子接收确认，请刷新后重试。')
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

export interface ConfirmPickupNodeReceiptRuntimeInput {
  pickupNodeId: string
  pickupNodeVersion: number
  receiverName: string
  eventSource: Extract<CuttingRuntimeEventSource, 'WEB' | 'PDA'>
  operatorRole: string
  toLocationRefs: PickupStorageLocationRef[]
}

function normalizePickupRuntimeQtyUnit(unit: string): CuttingRuntimeQtyUnit {
  return (['yard', '片', '件', '条', '粒', '卷', '公斤'].includes(unit) ? unit : '件') as CuttingRuntimeQtyUnit
}

export function syncCuttingPickupSessionWarehouseFactsRuntime(
  session: PickupSession,
  options: {
    eventSource: Extract<CuttingRuntimeEventSource, 'WEB' | 'PDA'>
    operatorRole: string
  } = { eventSource: 'PDA', operatorRole: 'PDA 仓管' },
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): void {
  const nodeSnapshot = session.pickupNodeSnapshot
  if (!nodeSnapshot) throw new Error('接收节点快照缺失，无法写入待加工仓流水。')
  nodeSnapshot.items.forEach((item, index) => {
    const runtimeUnit = normalizePickupRuntimeQtyUnit(item.unit)
    const pickupRecordId = session.pickupRecordIds[index] || ''
    appendCuttingRuntimeEventIdempotent({
      idempotencyKey: `cutting-pickup-inbound:${session.pickupSessionId}:${item.prepLineId}`,
      eventType: '中转仓接收',
      eventSource: options.eventSource,
      operatorName: session.receiverName,
      operatorRole: options.operatorRole,
      occurredAt: session.pickedAt,
      refs: {
        productionOrderId: nodeSnapshot.productionOrderId,
        productionOrderNo: nodeSnapshot.productionOrderNo,
        cutOrderNo: nodeSnapshot.productionOrderNo,
        handoverRecordId: `${session.pickupSessionId}:${item.prepLineId}`,
      },
      material: {
        materialSku: item.materialSku,
        materialName: item.materialName,
        materialColor: item.color,
        materialSpec: item.spec,
        materialAlias: item.materialName,
        unit: runtimeUnit,
      },
      inventoryEffect: {
        inventoryScope: '裁床待加工仓',
        direction: 'IN',
        qty: item.currentAvailableQty,
        unit: runtimeUnit,
        rollCount: item.rollCount,
        toWarehouseArea: session.toWarehouseArea,
        toLocationCode: session.toLocationCode,
      },
      payload: {
        pickupSessionId: session.pickupSessionId,
        pickupSessionNo: session.pickupSessionNo,
        pickupNodeId: session.pickupNodeId,
        pickupNodeVersion: session.pickupNodeVersion,
        pickupRecordId,
        pickupRecordIds: session.pickupRecordIds,
        prepOrderId: nodeSnapshot.prepOrderId,
        prepLineId: item.prepLineId,
        materialSku: item.materialSku,
        pickupQty: item.currentAvailableQty,
        unit: runtimeUnit,
        rollCount: item.rollCount,
        sourceLocations: item.sourceLocations,
        warehouseArea: session.toWarehouseArea,
        locationCode: session.toLocationCode,
        warehouseLocations: session.toLocationRefs,
        storageFootprint: session.storageFootprint,
        pickupBy: session.receiverName,
        pickupAt: session.pickedAt,
        warehouseSyncStatus: '已回写',
      },
    }, storage)
  })
}

/** Web 与 PDA 的唯一接收确认入口。两端只传操作来源，节点、数量、库位、幂等与原子写入规则完全共用。 */
export function confirmPickupNodeReceiptRuntime(
  input: ConfirmPickupNodeReceiptRuntimeInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupSession {
  const receiverName = input.receiverName.trim()
  if (!receiverName) throw new Error('请填写接收人。')
  const locationRefs = Array.from(new Map(input.toLocationRefs.map((ref) => [ref.locationId, structuredClone(ref)])).values())
  if (!locationRefs.length) throw new Error('请选择裁床待加工仓库位。')
  if (locationRefs.some((ref) => ref.warehouseKind !== 'WAIT_PROCESS')) {
    throw new Error('所选位置不是裁床待加工仓库位。')
  }
  const warehouseScopes = new Set(locationRefs.map((ref) => `${ref.factoryId}:${ref.warehouseId}:${ref.warehouseKind}`))
  if (warehouseScopes.size !== 1) throw new Error('一次接收只能选择同一个裁床待加工仓的库位。')

  const existing = getPickupSessionByNodeId(input.pickupNodeId, storage)
  if (existing) {
    if (existing.pickupNodeVersion !== input.pickupNodeVersion) {
      throw new Error('当前接收节点版本已变化，请重新核对。')
    }
    syncCuttingPickupSessionWarehouseFactsRuntime(existing, {
      eventSource: input.eventSource,
      operatorRole: input.operatorRole,
    }, storage)
    if (existing.warehouseSyncStatus !== '已回写') {
      recordPickupSessionWarehouseSyncResult(existing.pickupSessionId, { status: '已回写' }, storage)
    }
    return existing
  }

  const context = buildPickupRuntimeContext(storage, overrides)
  const node = context.activeNodes.find((candidate) => candidate.nodeId === input.pickupNodeId)
  if (!node || node.version !== input.pickupNodeVersion) {
    throw new Error('当前待接收物料已更新，请重新核对全部物料后再确认接收。')
  }
  const firstLocation = locationRefs[0]
  const idempotencyKey = `cutting-pickup:${input.pickupNodeId}:v${input.pickupNodeVersion}`
  return appendPickupSessionWithWarehouseFactsRuntime({
    pickupNodeId: input.pickupNodeId,
    pickupNodeVersion: input.pickupNodeVersion,
    receiverName,
    warehouseArea: firstLocation.areaName,
    locationCode: firstLocation.locationNo,
    waitProcessLedgerEventId: idempotencyKey,
    idempotencyKey,
    toLocationRefs: locationRefs,
  }, (session, transactionStorage) => syncCuttingPickupSessionWarehouseFactsRuntime(session, {
    eventSource: input.eventSource,
    operatorRole: input.operatorRole,
  }, transactionStorage), storage, overrides)
}
