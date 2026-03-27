import { cuttingOrderProgressRecords } from '../../data/fcs/cutting/order-progress'
import { buildCutPieceWarehouseViewModel } from '../../pages/process-factory/cutting/cut-piece-warehouse-model'
import { buildFabricWarehouseViewModel } from '../../pages/process-factory/cutting/fabric-warehouse-model'
import {
  buildFeiTicketsViewModel,
  buildSystemSeedFeiTicketLedger,
  CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY,
  CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY,
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  deserializeFeiTicketDraftsStorage,
  deserializeFeiTicketPrintJobsStorage,
  deserializeFeiTicketRecordsStorage,
  type FeiTicketLabelRecord,
  type FeiTicketPrintJob,
} from '../../pages/process-factory/cutting/fei-tickets-model'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
} from '../../pages/process-factory/cutting/marker-spreading-model'
import { buildMaterialPrepViewModel } from '../../pages/process-factory/cutting/material-prep-model'
import { buildProductionProgressRows } from '../../pages/process-factory/cutting/production-progress-model'
import {
  CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY,
  buildReplenishmentViewModel,
  deserializeReplenishmentActionsStorage,
  deserializeReplenishmentImpactPlansStorage,
  deserializeReplenishmentReviewsStorage,
} from '../../pages/process-factory/cutting/replenishment-model'
import { buildSampleWarehouseViewModel } from '../../pages/process-factory/cutting/sample-warehouse-model'
import {
  buildSpecialProcessViewModel,
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
} from '../../pages/process-factory/cutting/special-processes-model'
import {
  buildCuttingSummaryViewModel,
  buildSummaryDetailPanelData,
  type CuttingSummaryBuildOptions,
  type CuttingSummaryDetailPanelData,
  type CuttingSummaryViewModel,
} from '../../pages/process-factory/cutting/summary-model'
import {
  buildSystemSeedTransferBagStore,
  buildTransferBagViewModel,
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  deserializeTransferBagStorage,
  mergeTransferBagStores,
} from '../../pages/process-factory/cutting/transfer-bags-model'
import { buildTransferBagReturnViewModel } from '../../pages/process-factory/cutting/transfer-bag-return-model'
import {
  buildWarehouseOriginalRows,
  readWarehouseMergeBatchLedger,
} from '../../pages/process-factory/cutting/warehouse-shared'

function readStorageItem(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function mergeByKey<T extends Record<string, unknown>>(seed: T[], stored: T[], key: keyof T): T[] {
  const merged = new Map<string, T>()
  seed.forEach((item) => merged.set(String(item[key]), item))
  stored.forEach((item) => merged.set(String(item[key]), item))
  return Array.from(merged.values())
}

export function buildFcsCuttingRuntimeSources(): CuttingSummaryBuildOptions {
  const mergeBatches = readWarehouseMergeBatchLedger()
  const productionRows = buildProductionProgressRows(cuttingOrderProgressRecords)
  const originalRows = buildWarehouseOriginalRows()
  const materialPrepRows = buildMaterialPrepViewModel(cuttingOrderProgressRecords, mergeBatches).rows
  const markerStore = deserializeMarkerSpreadingStorage(
    readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY),
  )

  const feiDrafts = deserializeFeiTicketDraftsStorage(
    readStorageItem(typeof sessionStorage === 'undefined' ? undefined : sessionStorage, CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY),
  )
  const systemFeiLedger = buildSystemSeedFeiTicketLedger({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
  })
  const ticketRecords = mergeByKey<FeiTicketLabelRecord>(
    systemFeiLedger.ticketRecords,
    deserializeFeiTicketRecordsStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY),
    ),
    'ticketRecordId',
  )
  const printJobs = mergeByKey<FeiTicketPrintJob>(
    systemFeiLedger.printJobs,
    deserializeFeiTicketPrintJobsStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY),
    ),
    'printJobId',
  )
  const feiViewModel = buildFeiTicketsViewModel({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
    ticketRecords,
    printJobs,
    drafts: feiDrafts,
    prefilter: null,
  })

  const fabricWarehouseView = buildFabricWarehouseViewModel(originalRows)
  const cutPieceWarehouseView = buildCutPieceWarehouseViewModel(originalRows)
  const sampleWarehouseView = buildSampleWarehouseViewModel(originalRows)

  const transferSeed = buildSystemSeedTransferBagStore({
    originalRows,
    ticketRecords,
    mergeBatches,
  })
  const transferStore = mergeTransferBagStores(
    transferSeed,
    deserializeTransferBagStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY),
    ),
  )
  const transferBagView = buildTransferBagViewModel({
    originalRows,
    ticketRecords,
    mergeBatches,
    store: transferStore,
  })
  const transferBagReturnView = buildTransferBagReturnViewModel({
    store: transferStore,
    baseViewModel: transferBagView,
  })

  const replenishmentView = buildReplenishmentViewModel({
    materialPrepRows,
    originalRows,
    mergeBatches,
    markerStore,
    reviews: deserializeReplenishmentReviewsStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY),
    ),
    impactPlans: deserializeReplenishmentImpactPlansStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY),
    ),
    actions: deserializeReplenishmentActionsStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY),
    ),
  })

  const specialProcessView = buildSpecialProcessViewModel({
    originalRows,
    mergeBatches,
    orders: deserializeSpecialProcessOrdersStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY),
    ),
    bindingPayloads: deserializeBindingStripPayloadsStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY),
    ),
    scopeLines: deserializeSpecialProcessScopeLinesStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY),
    ),
    executionLogs: deserializeSpecialProcessExecutionLogsStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY),
    ),
    followupActions: deserializeSpecialProcessFollowupActionsStorage(
      readStorageItem(typeof localStorage === 'undefined' ? undefined : localStorage, CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY),
    ),
  })

  return {
    productionRows,
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
    feiViewModel,
    fabricWarehouseView,
    cutPieceWarehouseView,
    sampleWarehouseView,
    transferBagView,
    transferBagReturnView,
    replenishmentView,
    specialProcessView,
  }
}

export interface FcsCuttingRuntimeSummaryResult {
  sources: CuttingSummaryBuildOptions
  viewModel: CuttingSummaryViewModel
}

export function buildFcsCuttingRuntimeSummaryResult(): FcsCuttingRuntimeSummaryResult {
  const sources = buildFcsCuttingRuntimeSources()
  return {
    sources,
    viewModel: buildCuttingSummaryViewModel(sources),
  }
}

export function buildFcsCuttingRuntimeDetailData(
  rowId: string,
  runtime: FcsCuttingRuntimeSummaryResult = buildFcsCuttingRuntimeSummaryResult(),
): CuttingSummaryDetailPanelData | null {
  return buildSummaryDetailPanelData(rowId, {
    ...runtime.sources,
    rows: runtime.viewModel.rows,
  })
}
