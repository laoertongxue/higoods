import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress.ts'
import { listMarkerPlanRefSourceRecords } from '../../../data/fcs/cutting/marker-plan-ref-source.ts'
import type { CuttingOrderProgressRecord } from '../../../data/fcs/cutting/types.ts'
import type { CuttingSummaryBuildOptions } from './summary-model.ts'
import {
  createEmptyStore,
  type MarkerSpreadingLedgerSummary,
  type MarkerSpreadingStore,
} from './marker-spreading-model.ts'
import { buildMaterialPrepViewModel } from './material-prep-model.ts'
import {
  buildSystemSeedMarkerPlanRefs,
  type MarkerPlanRefRecord,
  type MarkerPlanRefSourceCutOrderItem,
} from './marker-plan-ref-model.ts'
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

function buildMarkerPlanSourceMarkerPlanRefItems(
  cutOrderRows: CutOrderRow[],
): MarkerPlanRefSourceCutOrderItem[] {
  const rowsById = Object.fromEntries(cutOrderRows.map((row) => [row.cutOrderId, row]))
  return listMarkerPlanRefSourceRecords().flatMap((record) =>
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
  markerPlanRefs: MarkerPlanRefRecord[]
}): MarkerSpreadingStore {
  const store = createEmptyStore()
  const cutOrderRows = options.cutOrderRows.slice(0, 2)
  const markerPlanRef = options.markerPlanRefs[0] || null
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
    ...(markerPlanRef
      ? [
          {
            spreadingSessionId: 'seed-spreading-marker-plan-ref-1',
            sessionNo: 'PB-SEED-901',
            contextType: 'marker-plan-ref',
            markerPlanId: markerPlanRef.markerPlanId,
            markerPlanNo: markerPlanRef.markerPlanNo,
            cutOrderIds: markerPlanRef.items.map((item) => item.cutOrderId),
            completionLinkage: {
              linkedCutOrderIds: markerPlanRef.items.map((item) => item.cutOrderId),
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
  const markerPlanRefs: MarkerPlanRefRecord[] = buildSystemSeedMarkerPlanRefs(
    buildMarkerPlanSourceMarkerPlanRefItems(seedCutOrderRows),
  )
  const cutOrderRows = buildCutOrderViewModel(progressRecords, markerPlanRefs, { progressRows: productionRows, markerPlanOccupancy }).rows
  const materialPrepRows = buildMaterialPrepViewModel(progressRecords, markerPlanRefs, { pickupWritebacks: [] }).rows
  const markerStore = buildMarkerPlanSeedMarkerStore({
    cutOrderRows,
    markerPlanRefs,
  })

  return {
    productionRows,
    cutOrderRows,
    materialPrepRows,
    markerPlanRefs,
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
