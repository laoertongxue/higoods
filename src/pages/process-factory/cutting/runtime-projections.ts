import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import { buildCutPieceWarehouseViewModel } from './cut-piece-warehouse-model.ts'
import { buildFabricWarehouseViewModel } from './fabric-warehouse-model.ts'
import {
  buildFeiTicketsViewModel,
  buildSystemSeedFeiTicketLedger,
  type FeiTicketDraft,
  type FeiTicketLabelRecord,
  type FeiTicketPrintJob,
} from './fei-tickets-model.ts'
import type { MarkerSpreadingStore } from './marker-spreading-model.ts'
import { buildMaterialPrepViewModel } from './material-prep-model.ts'
import { buildOriginalCutOrderViewModel, type OriginalCutOrderRow } from './original-orders-model.ts'
import { buildProductionProgressRows } from './production-progress-model.ts'
import {
  buildReplenishmentViewModel,
  type ReplenishmentFollowupAction,
  type ReplenishmentImpactPlan,
  type ReplenishmentReview,
} from './replenishment-model.ts'
import { buildSampleWarehouseViewModel } from './sample-warehouse-model.ts'
import {
  buildSpecialProcessViewModel,
  type BindingStripProcessPayload,
  type SpecialProcessExecutionLog,
  type SpecialProcessFollowupAction,
  type SpecialProcessOrder,
  type SpecialProcessScopeLine,
} from './special-processes-model.ts'
import {
  buildSummaryDetailPanelData,
  buildCuttingSummaryViewModel,
  type CuttingSummaryBuildOptions,
  type CuttingSummaryDetailPanelData,
  type CuttingSummaryViewModel,
} from './summary-model.ts'
import {
  buildSystemSeedTransferBagStore,
  buildTransferBagViewModel,
  mergeTransferBagStores,
  type TransferBagStore,
} from './transfer-bags-model.ts'
import { buildTransferBagReturnViewModel } from './transfer-bag-return-model.ts'
import type { MergeBatchItem, MergeBatchRecord, MergeBatchStatus } from './merge-batches-model.ts'

export interface FcsCuttingSummaryProjection {
  snapshot: CuttingDomainSnapshot
  sources: CuttingSummaryBuildOptions
  viewModel: CuttingSummaryViewModel
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function mergeByKey<T extends Record<string, unknown>>(seed: T[], stored: T[], key: keyof T): T[] {
  const merged = new Map<string, T>()
  seed.forEach((item) => merged.set(String(item[key]), item))
  stored.forEach((item) => merged.set(String(item[key]), item))
  return Array.from(merged.values())
}

function parseMergeBatchDate(mergeBatchNo: string): string {
  const match = mergeBatchNo.match(/(\d{2})(\d{2})(\d{2})/)
  if (!match) return ''
  return `20${match[1]}-${match[2]}-${match[3]}`
}

function inferSourceMergeBatchStatus(rows: OriginalCutOrderRow[]): MergeBatchStatus {
  if (rows.some((row) => row.currentStage.key === 'INBOUND')) return 'DONE'
  if (rows.some((row) => ['CUTTING', 'IN_BATCH'].includes(row.currentStage.key))) return 'CUTTING'
  return 'READY'
}

function buildSourceMergeBatchItems(source: {
  mergeBatchId: string
  originalRows: OriginalCutOrderRow[]
}): MergeBatchItem[] {
  return source.originalRows.map((row) => ({
    mergeBatchId: source.mergeBatchId,
    originalCutOrderId: row.originalCutOrderId,
    originalCutOrderNo: row.originalCutOrderNo,
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    styleName: row.styleName,
    urgencyLabel: row.urgencyLabel,
    plannedShipDate: row.plannedShipDate,
    plannedShipDateDisplay: row.plannedShipDate,
    materialSku: row.materialSku,
    materialCategory: row.materialCategory,
    materialLabel: row.materialLabel,
    currentStage: row.currentStage.label,
    cuttableStateLabel: row.cuttableState.label,
    sourceCompatibilityKey: `${row.styleCode}::${row.materialSku}`,
  }))
}

function buildRuntimeMergeBatchRecords(
  snapshot: CuttingDomainSnapshot,
  originalRows: OriginalCutOrderRow[],
): MergeBatchRecord[] {
  const originalRowsById = Object.fromEntries(originalRows.map((row) => [row.originalCutOrderId, row]))
  const sourceRecords = snapshot.mergeBatchState.sourceRecords
    .map((record) => {
      const rows = record.sourceOriginalCutOrderIds
        .map((id) => originalRowsById[id])
        .filter((row): row is OriginalCutOrderRow => Boolean(row))
      if (!rows.length) return null
      const materialSkuSummary = unique(rows.map((row) => row.materialSku)).join(' / ')
      return {
        mergeBatchId: record.mergeBatchId,
        mergeBatchNo: record.mergeBatchNo,
        status: inferSourceMergeBatchStatus(rows),
        compatibilityKey: `${rows[0]?.styleCode || ''}::${materialSkuSummary}`,
        styleCode: rows[0]?.styleCode || '',
        spuCode: rows[0]?.spuCode || '',
        styleName: rows[0]?.styleName || '',
        materialSkuSummary,
        sourceProductionOrderCount: unique(rows.map((row) => row.productionOrderId)).length,
        sourceOriginalCutOrderCount: rows.length,
        plannedCuttingGroup: '',
        plannedCuttingDate: parseMergeBatchDate(record.mergeBatchNo),
        note: '来源于裁片 runtime 主源聚合。',
        createdFrom: 'system-seed' as const,
        createdAt: parseMergeBatchDate(record.mergeBatchNo) ? `${parseMergeBatchDate(record.mergeBatchNo)} 09:00` : '',
        updatedAt: parseMergeBatchDate(record.mergeBatchNo) ? `${parseMergeBatchDate(record.mergeBatchNo)} 09:00` : '',
        items: buildSourceMergeBatchItems({
          mergeBatchId: record.mergeBatchId,
          originalRows: rows,
        }),
      }
    })
    .filter((record): record is MergeBatchRecord => record !== null)

  return mergeByKey(
    sourceRecords,
    snapshot.mergeBatchState.storedRecords as unknown as MergeBatchRecord[],
    'mergeBatchId',
  )
}

function buildOriginalRows(
  snapshot: CuttingDomainSnapshot,
  mergeBatches: MergeBatchRecord[],
  progressRows: ReturnType<typeof buildProductionProgressRows>,
): OriginalCutOrderRow[] {
  return buildOriginalCutOrderViewModel(snapshot.progressRecords, mergeBatches, { progressRows }).rows
}

function buildFeiLedger(options: {
  snapshot: CuttingDomainSnapshot
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: ReturnType<typeof buildMaterialPrepViewModel>['rows']
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
}) {
  const systemFeiLedger = buildSystemSeedFeiTicketLedger({
    originalRows: options.originalRows,
    materialPrepRows: options.materialPrepRows,
    mergeBatches: options.mergeBatches,
    markerStore: options.markerStore,
  })

  return {
    drafts: options.snapshot.feiTicketState.drafts as unknown as Record<string, FeiTicketDraft>,
    ticketRecords: mergeByKey(
      systemFeiLedger.ticketRecords,
      options.snapshot.feiTicketState.ticketRecords as unknown as FeiTicketLabelRecord[],
      'ticketRecordId',
    ),
    printJobs: mergeByKey(
      systemFeiLedger.printJobs,
      options.snapshot.feiTicketState.printJobs as unknown as FeiTicketPrintJob[],
      'printJobId',
    ),
  }
}

function buildTransferBagStore(
  snapshot: CuttingDomainSnapshot,
  originalRows: OriginalCutOrderRow[],
  ticketRecords: FeiTicketLabelRecord[],
  mergeBatches: MergeBatchRecord[],
): TransferBagStore {
  const seed = buildSystemSeedTransferBagStore({
    originalRows,
    ticketRecords,
    mergeBatches,
  })
  return mergeTransferBagStores(seed, snapshot.transferBagState.store as unknown as TransferBagStore)
}

export function mapCuttingDomainSnapshotToSummaryBuildOptions(
  snapshot: CuttingDomainSnapshot,
): CuttingSummaryBuildOptions {
  const progressRows = buildProductionProgressRows(snapshot.progressRecords, {
    pickupWritebacks: snapshot.pdaExecutionState.pickupWritebacks as never[],
    inboundWritebacks: snapshot.pdaExecutionState.inboundWritebacks as never[],
    handoverWritebacks: snapshot.pdaExecutionState.handoverWritebacks as never[],
    replenishmentFeedbackWritebacks: snapshot.pdaExecutionState.replenishmentFeedbackWritebacks as never[],
  })
  const seedOriginalRows = buildOriginalRows(snapshot, [], progressRows)
  const mergeBatches = buildRuntimeMergeBatchRecords(snapshot, seedOriginalRows)
  const originalRows = buildOriginalRows(snapshot, mergeBatches, progressRows)
  const materialPrepRows = buildMaterialPrepViewModel(snapshot.progressRecords, mergeBatches, {
    pickupWritebacks: snapshot.pdaExecutionState.pickupWritebacks as never[],
  }).rows
  const markerStore = snapshot.markerSpreadingState.store as unknown as MarkerSpreadingStore
  const feiLedger = buildFeiLedger({
    snapshot,
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
  })

  const feiViewModel = buildFeiTicketsViewModel({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
    ticketRecords: feiLedger.ticketRecords,
    printJobs: feiLedger.printJobs,
    drafts: feiLedger.drafts,
    prefilter: null,
  })

  const fabricWarehouseView = buildFabricWarehouseViewModel(
    originalRows,
    snapshot.warehouseState.fabricStocks,
  )
  const cutPieceWarehouseView = buildCutPieceWarehouseViewModel(
    originalRows,
    snapshot.warehouseState.cutPieceRecords,
    {
      inboundWritebacks: snapshot.pdaExecutionState.inboundWritebacks as never[],
      handoverWritebacks: snapshot.pdaExecutionState.handoverWritebacks as never[],
      warehouseWritebacks: snapshot.warehouseState.cutPieceWritebacks,
    },
  )
  const sampleWarehouseView = buildSampleWarehouseViewModel(
    originalRows,
    snapshot.warehouseState.sampleRecords,
    {
      sampleWritebacks: snapshot.warehouseState.sampleWritebacks,
    },
  )

  const transferStore = buildTransferBagStore(snapshot, originalRows, feiLedger.ticketRecords, mergeBatches)
  const transferBagView = buildTransferBagViewModel({
    originalRows,
    ticketRecords: feiLedger.ticketRecords,
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
    reviews: snapshot.replenishmentState.reviews as unknown as ReplenishmentReview[],
    impactPlans: snapshot.replenishmentState.impactPlans as unknown as ReplenishmentImpactPlan[],
    actions: snapshot.replenishmentState.actions as unknown as ReplenishmentFollowupAction[],
    pdaFeedbackWritebacks: snapshot.pdaExecutionState.replenishmentFeedbackWritebacks as never[],
  })

  const specialProcessView = buildSpecialProcessViewModel({
    originalRows,
    mergeBatches,
    orders: snapshot.specialProcessState.orders as unknown as SpecialProcessOrder[],
    bindingPayloads: snapshot.specialProcessState.bindingPayloads as unknown as BindingStripProcessPayload[],
    scopeLines: snapshot.specialProcessState.scopeLines as unknown as SpecialProcessScopeLine[],
    executionLogs: snapshot.specialProcessState.executionLogs as unknown as SpecialProcessExecutionLog[],
    followupActions: snapshot.specialProcessState.followupActions as unknown as SpecialProcessFollowupAction[],
  })

  return {
    productionRows: progressRows,
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

export function buildFcsCuttingSummaryProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): FcsCuttingSummaryProjection {
  const sources = mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot)
  return {
    snapshot,
    sources,
    viewModel: buildCuttingSummaryViewModel(sources),
  }
}

export function buildCuttingSummaryProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): FcsCuttingSummaryProjection {
  return buildFcsCuttingSummaryProjection(snapshot)
}

export function buildFcsCuttingSummaryDetailProjection(
  rowId: string,
  projection: FcsCuttingSummaryProjection = buildFcsCuttingSummaryProjection(),
): CuttingSummaryDetailPanelData | null {
  return buildSummaryDetailPanelData(rowId, {
    ...projection.sources,
    rows: projection.viewModel.rows,
  })
}

export function buildCuttingSummaryDetailProjection(
  rowId: string,
  projection: FcsCuttingSummaryProjection = buildFcsCuttingSummaryProjection(),
): CuttingSummaryDetailPanelData | null {
  return buildFcsCuttingSummaryDetailProjection(rowId, projection)
}
