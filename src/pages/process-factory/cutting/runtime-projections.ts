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
import { buildCutOrderViewModel, type CutOrderRow } from './cut-orders-model.ts'
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
import type { MarkerPlanSourceItem, MarkerPlanSourceRecord, MarkerPlanSourceStatus } from './marker-plan-source-model.ts'
import { readStoredMarkerPlanOccupancyLookup } from './marker-plan-occupancy.ts'

export interface FcsCuttingSummaryProjection {
  snapshot: CuttingDomainSnapshot
  sources: CuttingSummaryBuildOptions
  viewModel: CuttingSummaryViewModel
}

export type MarkerSpreadingSummaryBuildOptions = Pick<
  CuttingSummaryBuildOptions,
  'productionRows' | 'cutOrderRows' | 'materialPrepRows' | 'markerPlanSources' | 'markerStore'
>

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function mergeByKey<T extends Record<string, unknown>>(seed: T[], stored: T[], key: keyof T): T[] {
  const merged = new Map<string, T>()
  seed.forEach((item) => merged.set(String(item[key]), item))
  stored.forEach((item) => merged.set(String(item[key]), item))
  return Array.from(merged.values())
}

function parseMarkerPlanSourceDate(markerPlanNo: string): string {
  const match = markerPlanNo.match(/(\d{2})(\d{2})(\d{2})/)
  if (!match) return ''
  return `20${match[1]}-${match[2]}-${match[3]}`
}

function inferSourceMarkerPlanSourceStatus(rows: CutOrderRow[]): MarkerPlanSourceStatus {
  if (rows.some((row) => row.currentStage.key === 'INBOUND')) return 'DONE'
  if (rows.some((row) => ['CUTTING', 'IN_MARKER_PLAN'].includes(row.currentStage.key))) return 'CUTTING'
  return 'READY'
}

function buildSourceMarkerPlanSourceItems(source: {
  markerPlanId: string
  cutOrderRows: CutOrderRow[]
}): MarkerPlanSourceItem[] {
  return source.cutOrderRows.map((row) => ({
    markerPlanId: source.markerPlanId,
    cutOrderId: row.cutOrderId,
    cutOrderNo: row.cutOrderNo,
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
    sourceMarkerPlaningKey: `${row.styleCode}::${row.materialSku}`,
  }))
}

function buildRuntimeMarkerPlanSourceRecords(
  snapshot: CuttingDomainSnapshot,
  cutOrderRows: CutOrderRow[],
): MarkerPlanSourceRecord[] {
  const cutOrderRowsById = Object.fromEntries(cutOrderRows.map((row) => [row.cutOrderId, row]))
  const sourceRecords = snapshot.markerPlanSourceState.sourceRecords
    .map((record) => {
      const rows = record.sourceCutOrderIds
        .map((id) => cutOrderRowsById[id])
        .filter((row): row is CutOrderRow => Boolean(row))
      if (!rows.length) return null
      const materialSkuSummary = unique(rows.map((row) => row.materialSku)).join(' / ')
      return {
        markerPlanId: record.markerPlanId,
        markerPlanNo: record.markerPlanNo,
        status: inferSourceMarkerPlanSourceStatus(rows),
        markerPlanGroupKey: `${rows[0]?.styleCode || ''}::${materialSkuSummary}`,
        styleCode: rows[0]?.styleCode || '',
        spuCode: rows[0]?.spuCode || '',
        styleName: rows[0]?.styleName || '',
        materialSkuSummary,
        sourceProductionOrderCount: unique(rows.map((row) => row.productionOrderId)).length,
        sourceCutOrderCount: rows.length,
        plannedCuttingGroup: '',
        plannedCuttingDate: parseMarkerPlanSourceDate(record.markerPlanNo),
        note: '来源于裁片 runtime 主源聚合。',
        createdFrom: 'system-seed' as const,
        createdAt: parseMarkerPlanSourceDate(record.markerPlanNo) ? `${parseMarkerPlanSourceDate(record.markerPlanNo)} 09:00` : '',
        updatedAt: parseMarkerPlanSourceDate(record.markerPlanNo) ? `${parseMarkerPlanSourceDate(record.markerPlanNo)} 09:00` : '',
        items: buildSourceMarkerPlanSourceItems({
          markerPlanId: record.markerPlanId,
          cutOrderRows: rows,
        }),
      }
    })
    .filter((record): record is MarkerPlanSourceRecord => record !== null)

  return mergeByKey(
    sourceRecords,
    snapshot.markerPlanSourceState.storedRecords as unknown as MarkerPlanSourceRecord[],
    'markerPlanId',
  )
}

function buildCutOrderRows(
  snapshot: CuttingDomainSnapshot,
  markerPlanSources: MarkerPlanSourceRecord[],
  progressRows: ReturnType<typeof buildProductionProgressRows>,
): CutOrderRow[] {
  return buildCutOrderViewModel(snapshot.progressRecords, markerPlanSources, {
    progressRows,
    markerPlanOccupancy: readStoredMarkerPlanOccupancyLookup(),
  }).rows
}

function buildFeiLedger(options: {
  snapshot: CuttingDomainSnapshot
  cutOrderRows: CutOrderRow[]
  materialPrepRows: ReturnType<typeof buildMaterialPrepViewModel>['rows']
  markerPlanSources: MarkerPlanSourceRecord[]
  markerStore: MarkerSpreadingStore
}) {
  const systemFeiLedger = buildSystemSeedFeiTicketLedger({
    cutOrderRows: options.cutOrderRows,
    materialPrepRows: options.materialPrepRows,
    markerPlanSources: options.markerPlanSources,
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
  cutOrderRows: CutOrderRow[],
  ticketRecords: FeiTicketLabelRecord[],
  markerPlanSources: MarkerPlanSourceRecord[],
): TransferBagStore {
  const seed = buildSystemSeedTransferBagStore({
    cutOrderRows,
    ticketRecords,
    markerPlanSources,
  })
  return mergeTransferBagStores(seed, snapshot.transferBagState.store as unknown as TransferBagStore)
}

export function mapCuttingDomainSnapshotToSummaryBuildOptions(
  snapshot: CuttingDomainSnapshot,
): CuttingSummaryBuildOptions {
  const progressRows = buildProductionProgressRows(snapshot.progressRecords, {
    pickupEvents: snapshot.pdaExecutionState.pickupEvents as never[],
    inboundEvents: snapshot.pdaExecutionState.inboundEvents as never[],
    handoverEvents: snapshot.pdaExecutionState.handoverEvents as never[],
    replenishmentFeedbackEvents: snapshot.pdaExecutionState.replenishmentFeedbackEvents as never[],
  })
  const seedCutOrderRows = buildCutOrderRows(snapshot, [], progressRows)
  const markerPlanSources = buildRuntimeMarkerPlanSourceRecords(snapshot, seedCutOrderRows)
  const cutOrderRows = buildCutOrderRows(snapshot, markerPlanSources, progressRows)
  const materialPrepRows = buildMaterialPrepViewModel(snapshot.progressRecords, markerPlanSources, {
    pickupEvents: snapshot.pdaExecutionState.pickupEvents as never[],
  }).rows
  const markerStore = snapshot.markerSpreadingState.store as unknown as MarkerSpreadingStore
  const feiLedger = buildFeiLedger({
    snapshot,
    cutOrderRows,
    materialPrepRows,
    markerPlanSources,
    markerStore,
  })

  const feiViewModel = buildFeiTicketsViewModel({
    cutOrderRows,
    materialPrepRows,
    markerPlanSources,
    markerStore,
    ticketRecords: feiLedger.ticketRecords,
    printJobs: feiLedger.printJobs,
    drafts: feiLedger.drafts,
    prefilter: null,
  })

  const fabricWarehouseView = buildFabricWarehouseViewModel(
    cutOrderRows,
    snapshot.warehouseState.fabricStocks,
  )
  const cutPieceWarehouseView = buildCutPieceWarehouseViewModel(
    cutOrderRows,
    snapshot.warehouseState.cutPieceRecords,
    {
      inboundEvents: snapshot.pdaExecutionState.inboundEvents as never[],
      handoverEvents: snapshot.pdaExecutionState.handoverEvents as never[],
      warehouseWritebacks: snapshot.warehouseState.cutPieceWritebacks,
    },
  )
  const sampleWarehouseView = buildSampleWarehouseViewModel(
    cutOrderRows,
    snapshot.warehouseState.sampleRecords,
    {
      sampleWritebacks: snapshot.warehouseState.sampleWritebacks,
    },
  )

  const transferStore = buildTransferBagStore(snapshot, cutOrderRows, feiLedger.ticketRecords, markerPlanSources)
  const transferBagView = buildTransferBagViewModel({
    cutOrderRows,
    ticketRecords: feiLedger.ticketRecords,
    markerPlanSources,
    store: transferStore,
  })
  const transferBagReturnView = buildTransferBagReturnViewModel({
    store: transferStore,
    baseViewModel: transferBagView,
  })

  const replenishmentView = buildReplenishmentViewModel({
    materialPrepRows,
    cutOrderRows,
    markerPlanSources,
    markerStore,
    reviews: snapshot.replenishmentState.reviews as unknown as ReplenishmentReview[],
    impactPlans: snapshot.replenishmentState.impactPlans as unknown as ReplenishmentImpactPlan[],
    actions: snapshot.replenishmentState.actions as unknown as ReplenishmentFollowupAction[],
  })

  const specialProcessView = buildSpecialProcessViewModel({
    cutOrderRows,
    markerPlanSources,
    orders: snapshot.specialProcessState.orders as unknown as SpecialProcessOrder[],
    bindingPayloads: snapshot.specialProcessState.bindingPayloads as unknown as BindingStripProcessPayload[],
    scopeLines: snapshot.specialProcessState.scopeLines as unknown as SpecialProcessScopeLine[],
    executionLogs: snapshot.specialProcessState.executionLogs as unknown as SpecialProcessExecutionLog[],
    followupActions: snapshot.specialProcessState.followupActions as unknown as SpecialProcessFollowupAction[],
  })

  return {
    productionRows: progressRows,
    cutOrderRows,
    materialPrepRows,
    markerPlanSources,
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

export function mapCuttingDomainSnapshotToMarkerSpreadingBuildOptions(
  snapshot: CuttingDomainSnapshot,
): MarkerSpreadingSummaryBuildOptions {
  const progressRows = buildProductionProgressRows(snapshot.progressRecords, {
    pickupEvents: snapshot.pdaExecutionState.pickupEvents as never[],
    inboundEvents: snapshot.pdaExecutionState.inboundEvents as never[],
    handoverEvents: snapshot.pdaExecutionState.handoverEvents as never[],
    replenishmentFeedbackEvents: snapshot.pdaExecutionState.replenishmentFeedbackEvents as never[],
  })
  const seedCutOrderRows = buildCutOrderRows(snapshot, [], progressRows)
  const markerPlanSources = buildRuntimeMarkerPlanSourceRecords(snapshot, seedCutOrderRows)
  const cutOrderRows = buildCutOrderRows(snapshot, markerPlanSources, progressRows)
  const materialPrepRows = buildMaterialPrepViewModel(snapshot.progressRecords, markerPlanSources, {
    pickupEvents: snapshot.pdaExecutionState.pickupEvents as never[],
    pendingPrepFollowups: [],
    includeClaimDisputes: false,
  }).rows

  return {
    productionRows: progressRows,
    cutOrderRows,
    materialPrepRows,
    markerPlanSources,
    markerStore: snapshot.markerSpreadingState.store as unknown as MarkerSpreadingStore,
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
