import {
  getBrowserLocalStorage,
  getBrowserSessionStorage,
  readBrowserStorageItem,
} from '../../browser-storage.ts'
import {
  productionOrders,
} from '../production-orders.ts'
import {
  listGeneratedOriginalCutOrderSourceRecords,
} from './generated-original-cut-orders.ts'
import {
  listMergeBatchSourceRecords,
} from './merge-batch-source.ts'
import { cuttingOrderProgressRecords } from './order-progress.ts'
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
  CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY,
  deserializeReplenishmentActionsStorage,
  deserializeReplenishmentImpactPlansStorage,
  deserializeReplenishmentReviewsStorage,
} from './storage/replenishment-storage.ts'
import {
  CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY,
  deserializeBindingStripPayloadsStorage,
  deserializeSpecialProcessExecutionLogsStorage,
  deserializeSpecialProcessFollowupActionsStorage,
  deserializeSpecialProcessOrdersStorage,
  deserializeSpecialProcessScopeLinesStorage,
} from './storage/special-processes-storage.ts'
import {
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  deserializeTransferBagStorage,
} from './storage/transfer-bags-storage.ts'
import {
  CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY,
  deserializePdaExecutionWritebackStorage,
} from './pda-execution-writeback-ledger.ts'
import {
  CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY,
  deserializeMergeBatchStorage,
} from './storage/merge-batches-storage.ts'
import {
  CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY,
  deserializeCuttingWarehouseWritebackStorage,
} from './warehouse-writeback-ledger.ts'

export function readCuttingMarkerStore() {
  return deserializeMarkerSpreadingStorage(
    readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY),
  )
}

export function readCuttingFeiRuntimeState() {
  return {
    drafts: deserializeFeiTicketDraftsStorage(
      readBrowserStorageItem(getBrowserSessionStorage(), CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY),
    ),
    ticketRecords: deserializeFeiTicketRecordsStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY),
    ),
    printJobs: deserializeFeiTicketPrintJobsStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY),
    ),
  }
}

export function readCuttingTransferBagRuntimeState() {
  return {
    store: deserializeTransferBagStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY),
    ),
  }
}

export function readCuttingReplenishmentRuntimeState() {
  return {
    reviews: deserializeReplenishmentReviewsStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY),
    ),
    impactPlans: deserializeReplenishmentImpactPlansStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY),
    ),
    actions: deserializeReplenishmentActionsStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY),
    ),
  }
}

export function readCuttingSpecialProcessRuntimeState() {
  return {
    orders: deserializeSpecialProcessOrdersStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY),
    ),
    bindingPayloads: deserializeBindingStripPayloadsStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY),
    ),
    scopeLines: deserializeSpecialProcessScopeLinesStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY),
    ),
    executionLogs: deserializeSpecialProcessExecutionLogsStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY),
    ),
    followupActions: deserializeSpecialProcessFollowupActionsStorage(
      readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY),
    ),
  }
}

export function readCuttingPdaExecutionRuntimeState() {
  const store = deserializePdaExecutionWritebackStorage(
    readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY),
  )
  return {
    pickupWritebacks: store.pickupWritebacks,
    inboundWritebacks: store.inboundWritebacks,
    handoverWritebacks: store.handoverWritebacks,
    replenishmentFeedbackWritebacks: store.replenishmentFeedbackWritebacks,
  }
}

export function readCuttingStoredMergeBatchLedger() {
  return deserializeMergeBatchStorage(
    readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY),
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
  const replenishmentRuntimeState = readCuttingReplenishmentRuntimeState()
  const specialProcessRuntimeState = readCuttingSpecialProcessRuntimeState()
  const pdaExecutionRuntimeState = readCuttingPdaExecutionRuntimeState()
  const warehouseWritebackRuntimeState = readCuttingWarehouseWritebackRuntimeState()

  return {
    productionOrders: productionOrders.map((order) => ({ ...order })),
    originalCutOrders: listGeneratedOriginalCutOrderSourceRecords(),
    mergeBatchState: {
      sourceRecords: listMergeBatchSourceRecords(),
      storedRecords: readCuttingStoredMergeBatchLedger().map((record) => ({ ...record })),
    },
    progressRecords: cuttingOrderProgressRecords.map((record) => ({
      ...record,
      materialLines: record.materialLines.map((line) => ({
        ...line,
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
    replenishmentState: {
      reviews: replenishmentRuntimeState.reviews as Array<Record<string, unknown>>,
      impactPlans: replenishmentRuntimeState.impactPlans as Array<Record<string, unknown>>,
      actions: replenishmentRuntimeState.actions as Array<Record<string, unknown>>,
    },
    specialProcessState: {
      orders: specialProcessRuntimeState.orders as Array<Record<string, unknown>>,
      bindingPayloads: specialProcessRuntimeState.bindingPayloads as Array<Record<string, unknown>>,
      scopeLines: specialProcessRuntimeState.scopeLines as Array<Record<string, unknown>>,
      executionLogs: specialProcessRuntimeState.executionLogs as Array<Record<string, unknown>>,
      followupActions: specialProcessRuntimeState.followupActions as Array<Record<string, unknown>>,
    },
    pdaExecutionState: {
      pickupWritebacks: pdaExecutionRuntimeState.pickupWritebacks as Array<Record<string, unknown>>,
      inboundWritebacks: pdaExecutionRuntimeState.inboundWritebacks as Array<Record<string, unknown>>,
      handoverWritebacks: pdaExecutionRuntimeState.handoverWritebacks as Array<Record<string, unknown>>,
      replenishmentFeedbackWritebacks: pdaExecutionRuntimeState.replenishmentFeedbackWritebacks as Array<Record<string, unknown>>,
    },
  }
}
