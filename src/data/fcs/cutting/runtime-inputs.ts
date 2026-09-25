import { readPartTicketValue, PART_TICKET_KEYS } from './part-ticket-records.ts'
import {
  getBrowserLocalStorage,
  readBrowserStorageItem,
} from '../../browser-storage.ts'
import {
  listCuttingProductionOrdersWithFormalTechPack,
  listGeneratedCutOrderSourceRecords,
} from './generated-cut-orders.ts'
import {
  CUTTING_MARKER_PLAN_SOURCE_LEDGER_STORAGE_KEY,
  listMarkerPlanCutOrderSourceRecords,
} from './marker-plan-source.ts'
import { listCurrentCuttingOrderProgressRecords } from './order-progress.ts'
import {
  listFormalCutPieceWarehouseRecords,
  listFormalFabricWarehouseRecords,
  listFormalSampleWarehouseRecords,
} from './warehouse-runtime.ts'
import type { CuttingRuntimeInputs } from '../../../domain/fcs-cutting-runtime/types.ts'
import {
  CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY,
  CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY,
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  deserializeFeiTicketDraftsStorage,
  deserializeFeiTicketPrintJobsStorage,
  deserializeFeiTicketRecordsStorage,
} from './storage/fei-tickets-storage.ts'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
} from './marker-spreading-ledger.ts'
import {
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  deserializeTransferBagStorage,
} from './storage/transfer-bags-storage.ts'
import {
  CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY,
  deserializeCuttingWarehouseWritebackStorage,
} from './warehouse-writeback-ledger.ts'
import {
  CUTTING_CUT_ORDER_CLOSE_RECORDS_STORAGE_KEY,
} from './cut-order-close-records.ts'
import {
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  deserializeCuttingRuntimeEventLedgerStorage,
  listRuntimePdaExecutionEventProjections,
  getCuttingRuntimeEventProjectionRevision,
} from './cutting-runtime-event-ledger.ts'

const CUTTING_RUNTIME_LOCAL_STORAGE_SIGNATURE_KEYS = [
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY,
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  CUTTING_MARKER_PLAN_SOURCE_LEDGER_STORAGE_KEY,
  CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY,
  CUTTING_CUT_ORDER_CLOSE_RECORDS_STORAGE_KEY,
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
]

const CUTTING_RUNTIME_SESSION_STORAGE_SIGNATURE_KEYS = [
  CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY,
]

export function getCuttingRuntimeStorageSignature(): string {
  const localStorageRef = getBrowserLocalStorage()
  const localSignature = CUTTING_RUNTIME_LOCAL_STORAGE_SIGNATURE_KEYS
    .map((key) => `${key}:${Object.values(PART_TICKET_KEYS).includes(key as never) ? readPartTicketValue(key) || '' : readBrowserStorageItem(localStorageRef, key) || ''}`)
    .join('\n')
  const sessionSignature = CUTTING_RUNTIME_SESSION_STORAGE_SIGNATURE_KEYS
    .map((key) => `${key}:${readPartTicketValue(key) || ''}`)
    .join('\n')

  return `${localSignature}\n${sessionSignature}\nmanaged-events:${getCuttingRuntimeEventProjectionRevision()}`
}

export function readCuttingMarkerStore() {
  return deserializeMarkerSpreadingStorage(
    readPartTicketValue(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY),
  )
}

export function readCuttingFeiRuntimeState() {
  return {
    drafts: deserializeFeiTicketDraftsStorage(
      readPartTicketValue(CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY),
    ),
    ticketRecords: deserializeFeiTicketRecordsStorage(
      readPartTicketValue(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY),
    ),
    printJobs: deserializeFeiTicketPrintJobsStorage(
      readPartTicketValue(CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY),
    ),
  }
}

export function readCuttingTransferBagRuntimeState() {
  return {
    store: deserializeTransferBagStorage(
      readPartTicketValue(CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY),
    ),
  }
}

export function readCuttingPdaExecutionRuntimeState() {
  return listRuntimePdaExecutionEventProjections(getBrowserLocalStorage())
}

export function readCuttingRuntimeEventState() {
  return deserializeCuttingRuntimeEventLedgerStorage(
    readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY),
  )
}

function deserializeStoredMarkerPlanSourceLedger(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((record): record is Record<string, unknown> => Boolean(record && typeof record === 'object'))
      : []
  } catch {
    return []
  }
}

export function readCuttingStoredMarkerPlanSourceLedger() {
  return deserializeStoredMarkerPlanSourceLedger(
    readPartTicketValue(CUTTING_MARKER_PLAN_SOURCE_LEDGER_STORAGE_KEY),
  )
}

export function readCuttingWarehouseWritebackRuntimeState() {
  const store = deserializeCuttingWarehouseWritebackStorage(
    readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY),
  )
  return {
    cutPieceWritebacks: store.cutPieceWritebacks,
    sampleWritebacks: store.sampleWritebacks,
  }
}

export function readCuttingRuntimeInputs(): CuttingRuntimeInputs {
  const feiRuntimeState = readCuttingFeiRuntimeState()
  const pdaExecutionRuntimeState = readCuttingPdaExecutionRuntimeState()
  const runtimeEventState = readCuttingRuntimeEventState()
  const warehouseWritebackRuntimeState = readCuttingWarehouseWritebackRuntimeState()

  return {
    productionOrders: listCuttingProductionOrdersWithFormalTechPack().map((order) => ({ ...order })),
    cutOrders: listGeneratedCutOrderSourceRecords(),
    markerPlanSourceState: {
      sourceRecords: listMarkerPlanCutOrderSourceRecords(),
      storedRecords: readCuttingStoredMarkerPlanSourceLedger().map((record) => ({ ...record })),
    },
    progressRecords: listCurrentCuttingOrderProgressRecords().map((record) => ({
      ...record,
      materialLines: record.materialLines.map((line) => ({
        ...line,
        materialIdentity: line.materialIdentity ? { ...line.materialIdentity } : undefined,
        patternIdentity: line.patternIdentity
          ? {
              ...line.patternIdentity,
              piecePartCodes: [...line.patternIdentity.piecePartCodes],
              piecePartNames: [...line.patternIdentity.piecePartNames],
            }
          : undefined,
        skuScopeLines: (line.skuScopeLines || []).map((scope) => ({ ...scope })),
        pieceProgressLines: (line.pieceProgressLines || []).map((piece) => ({ ...piece })),
        issueFlags: [...line.issueFlags],
      })),
      skuRequirementLines: (record.skuRequirementLines || []).map((line) => ({ ...line })),
      riskFlags: [...record.riskFlags],
    })),
    warehouseState: {
      fabricStocks: listFormalFabricWarehouseRecords(),
      cutPieceRecords: listFormalCutPieceWarehouseRecords(),
      sampleRecords: listFormalSampleWarehouseRecords(),
      cutPieceWritebacks: warehouseWritebackRuntimeState.cutPieceWritebacks,
      sampleWritebacks: warehouseWritebackRuntimeState.sampleWritebacks,
    },
    markerSpreadingState: {
      store: readCuttingMarkerStore() as unknown as Record<string, unknown>,
    },
    feiTicketState: {
      drafts: feiRuntimeState.drafts as Record<string, unknown>,
      ticketRecords: feiRuntimeState.ticketRecords as Array<Record<string, unknown>>,
      printJobs: feiRuntimeState.printJobs as Array<Record<string, unknown>>,
    },
    transferBagState: {
      store: readCuttingTransferBagRuntimeState().store as unknown as Record<string, unknown>,
    },
    pdaExecutionState: {
      pickupEvents: pdaExecutionRuntimeState.pickupEvents,
      inboundEvents: pdaExecutionRuntimeState.inboundEvents,
      handoverEvents: pdaExecutionRuntimeState.handoverEvents,
    },
    runtimeEventState: {
      events: runtimeEventState.events,
    },
  }
}

/** 打印来源只读取裁片身份、唛架、铺布和菲票；不查询收料及仓储执行汇总。 */
export type CuttingTicketSourceSnapshot = Pick<CuttingRuntimeInputs, 'progressRecords' | 'markerPlanSourceState' | 'markerSpreadingState' | 'feiTicketState' | 'transferBagState'>
export function readCuttingTicketSourceSnapshot(): CuttingTicketSourceSnapshot {
 const fei = readCuttingFeiRuntimeState()
 return {
  progressRecords: listCurrentCuttingOrderProgressRecords(),
  markerPlanSourceState: {sourceRecords: listMarkerPlanCutOrderSourceRecords(), storedRecords: readCuttingStoredMarkerPlanSourceLedger()},
  markerSpreadingState: {store: readCuttingMarkerStore() as unknown as Record<string,unknown>},
  feiTicketState: {drafts: fei.drafts as Record<string,unknown>, ticketRecords: fei.ticketRecords as Array<Record<string,unknown>>, printJobs: fei.printJobs as Array<Record<string,unknown>>},
  transferBagState: {store: readCuttingTransferBagRuntimeState().store as unknown as Record<string,unknown>},
 }
}
