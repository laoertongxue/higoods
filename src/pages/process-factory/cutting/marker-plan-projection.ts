import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress.ts'
import { listMarkerPlanCutOrderSourceRecords } from '../../../data/fcs/cutting/marker-plan-source.ts'
import type { CuttingOrderProgressRecord } from '../../../data/fcs/cutting/types.ts'
import type { CuttingSummaryBuildOptions } from './summary-model.ts'
import {
  createEmptyStore,
  type MarkerSpreadingLedgerSummary,
  type MarkerSpreadingStore,
} from './marker-spreading-model.ts'
import { buildMaterialPrepViewModel } from './material-prep-model.ts'
import {
  buildSystemSeedMarkerPlanSources,
  type MarkerPlanSourceRecord,
  type MarkerPlanCutOrderSourceItem,
} from './marker-plan-source-model.ts'
import { buildCutOrderViewModel, type CutOrderRow } from './cut-orders-model.ts'
import { buildProductionProgressRows } from './production-progress-model.ts'
import { buildMarkerPlanViewModel, deserializeMarkerPlanStorage, getMarkerPlanStorageKey, type MarkerPlan, type MarkerPlanViewModel } from './marker-plan-model.ts'
import { buildMarkerPlanOccupancyLookup, type MarkerPlanOccupancyLookup } from './marker-plan-occupancy.ts'

export interface MarkerPlanProjection {
  snapshot: CuttingDomainSnapshot
  sources: CuttingSummaryBuildOptions
  storedPlans: MarkerPlan[]
  viewModel: MarkerPlanViewModel
}

function readStoredMarkerPlans(): MarkerPlan[] {
  try {
    return deserializeMarkerPlanStorage(localStorage.getItem(getMarkerPlanStorageKey()))
  } catch {
    return []
  }
}

function buildMarkerPlanSourceMarkerPlanSourceItems(
  cutOrderRows: CutOrderRow[],
): MarkerPlanCutOrderSourceItem[] {
  const rowsById = Object.fromEntries(cutOrderRows.map((row) => [row.cutOrderId, row]))
  return listMarkerPlanCutOrderSourceRecords().flatMap((record) =>
    record.sourceCutOrderIds
      .map((cutOrderId) => rowsById[cutOrderId] || null)
      .filter((row): row is CutOrderRow => Boolean(row))
      .map((row) => ({
        id: row.cutOrderId,
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
        currentStage: row.currentStageLabel,
        markerPlanOccupancyStatus: row.activeMarkerPlanId ? 'IN_MARKER_PLAN' : 'AVAILABLE',
        cuttableState: {
          label: row.cuttableState.label,
          selectable: row.cuttableState.selectable,
          key: row.cuttableState.key,
        },
        markerPlanGroupKey: `${row.styleCode}::${row.materialSku}`,
        markerPlanNo: record.markerPlanNo,
      })),
  )
}

function buildMarkerPlanSeedMarkerStore(options: {
  cutOrderRows: CutOrderRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
}): MarkerSpreadingStore {
  const store = createEmptyStore()
  const cutOrderRows = options.cutOrderRows.slice(0, 2)
  const markerPlanSource = options.markerPlanSources[0] || null
  const sessions = [
    ...cutOrderRows.map((row, index) => ({
      spreadingSessionId: `seed-spreading-cut-order-${index + 1}`,
      sessionNo: `PB-SEED-${String(index + 1).padStart(3, '0')}`,
      contextType: 'cut-order',
      cutOrderIds: [row.cutOrderId],
      completionLinkage: {
        linkedCutOrderIds: [row.cutOrderId],
      },
    })),
    ...(markerPlanSource
      ? [
          {
            spreadingSessionId: 'seed-spreading-marker-plan-1',
            sessionNo: 'PB-SEED-901',
            contextType: 'marker-plan',
            markerPlanId: markerPlanSource.markerPlanId,
            markerPlanNo: markerPlanSource.markerPlanNo,
            cutOrderIds: markerPlanSource.items.map((item) => item.cutOrderId),
            completionLinkage: {
              linkedCutOrderIds: markerPlanSource.items.map((item) => item.cutOrderId),
            },
          },
        ]
      : []),
  ]

  return {
    ...store,
    sessions: sessions as MarkerSpreadingLedgerSummary['sessions'] as unknown as MarkerSpreadingStore['sessions'],
  }
}

export function buildMarkerPlanSummaryBuildOptions(
  progressRecords: CuttingOrderProgressRecord[] = cuttingOrderProgressRecords,
  markerPlanOccupancy: MarkerPlanOccupancyLookup = {},
): CuttingSummaryBuildOptions {
  const productionRows = buildProductionProgressRows(progressRecords)
  const seedCutOrderRows = buildCutOrderViewModel(progressRecords, [], { progressRows: productionRows, markerPlanOccupancy }).rows
  const markerPlanSources: MarkerPlanSourceRecord[] = buildSystemSeedMarkerPlanSources(
    buildMarkerPlanSourceMarkerPlanSourceItems(seedCutOrderRows),
  )
  const cutOrderRows = buildCutOrderViewModel(progressRecords, markerPlanSources, { progressRows: productionRows, markerPlanOccupancy }).rows
  const materialPrepRows = buildMaterialPrepViewModel(progressRecords, markerPlanSources, { pickupEvents: [] }).rows
  const markerStore = buildMarkerPlanSeedMarkerStore({
    cutOrderRows,
    markerPlanSources,
  })

  return {
    productionRows,
    cutOrderRows,
    materialPrepRows,
    markerPlanSources,
    markerStore,
    feiViewModel: { rows: [], printableUnits: [], unitRowsById: {}, unitsById: {}, ticketRecords: [], printJobs: [], ticketRecordsById: {}, printJobsById: {} } as never,
    fabricWarehouseView: { rows: [], rowsById: {}, stockItems: [] } as never,
    cutPieceWarehouseView: { rows: [], rowsById: {}, inventoryItems: [] } as never,
    sampleWarehouseView: { rows: [], rowsById: {} } as never,
    transferBagView: { rows: [], rowsById: {} } as never,
    transferBagReturnView: { rows: [], rowsById: {} } as never,
    replenishmentView: { rows: [], rowsById: {} } as never,
    specialProcessView: { rows: [], rowsById: {} } as never,
  }
}

export function buildMarkerPlanProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): MarkerPlanProjection {
  const storedPlans = readStoredMarkerPlans()
  const sources = buildMarkerPlanSummaryBuildOptions(snapshot.progressRecords, buildMarkerPlanOccupancyLookup(storedPlans))
  return {
    snapshot,
    sources,
    storedPlans,
    viewModel: buildMarkerPlanViewModel(sources, storedPlans),
  }
}
