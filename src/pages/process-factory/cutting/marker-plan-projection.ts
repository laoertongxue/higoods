import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress.ts'
import { listMergeBatchSourceRecords } from '../../../data/fcs/cutting/merge-batch-source.ts'
import type { CuttingOrderProgressRecord } from '../../../data/fcs/cutting/types.ts'
import type { CuttingSummaryBuildOptions } from './summary-model.ts'
import { createEmptyStore, type MarkerSpreadingStore } from './marker-spreading-model.ts'
import { buildMaterialPrepViewModel } from './material-prep-model.ts'
import {
  buildSystemSeedMergeBatches,
  type MergeBatchRecord,
  type MergeBatchSourceOriginalOrderItem,
} from './merge-batches-model.ts'
import { buildOriginalCutOrderViewModel, type OriginalCutOrderRow } from './original-orders-model.ts'
import { buildProductionProgressRows } from './production-progress-model.ts'
import { buildMarkerPlanViewModel, deserializeMarkerPlanStorage, getMarkerPlanStorageKey, type MarkerPlan, type MarkerPlanViewModel } from './marker-plan-model.ts'

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

function buildMarkerPlanSourceMergeBatchItems(
  originalRows: OriginalCutOrderRow[],
): MergeBatchSourceOriginalOrderItem[] {
  const rowsById = Object.fromEntries(originalRows.map((row) => [row.originalCutOrderId, row]))
  return listMergeBatchSourceRecords().flatMap((record) =>
    record.sourceOriginalCutOrderIds
      .map((originalCutOrderId) => rowsById[originalCutOrderId] || null)
      .filter((row): row is OriginalCutOrderRow => Boolean(row))
      .map((row) => ({
        id: row.originalCutOrderId,
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
        currentStage: row.currentStageLabel,
        batchOccupancyStatus: row.activeBatchId ? 'IN_BATCH' : 'AVAILABLE',
        cuttableState: {
          label: row.cuttableState.label,
          selectable: row.cuttableState.selectable,
          key: row.cuttableState.key,
        },
        compatibilityKey: `${row.styleCode}::${row.materialSku}`,
        mergeBatchNo: record.mergeBatchNo,
      })),
  )
}

function buildMarkerPlanSeedMarkerStore(options: {
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
}): MarkerSpreadingStore {
  const store = createEmptyStore()
  const originalRows = options.originalRows.slice(0, 2)
  const mergeBatch = options.mergeBatches[0] || null
  const sessions = [
    ...originalRows.map((row, index) => ({
      spreadingSessionId: `seed-spreading-original-${index + 1}`,
      sessionNo: `PB-SEED-${String(index + 1).padStart(3, '0')}`,
      contextType: 'original-order',
      originalCutOrderIds: [row.originalCutOrderId],
      completionLinkage: {
        linkedOriginalCutOrderIds: [row.originalCutOrderId],
      },
    })),
    ...(mergeBatch
      ? [
          {
            spreadingSessionId: 'seed-spreading-merge-batch-1',
            sessionNo: 'PB-SEED-901',
            contextType: 'merge-batch',
            mergeBatchId: mergeBatch.mergeBatchId,
            mergeBatchNo: mergeBatch.mergeBatchNo,
            originalCutOrderIds: mergeBatch.items.map((item) => item.originalCutOrderId),
            completionLinkage: {
              linkedOriginalCutOrderIds: mergeBatch.items.map((item) => item.originalCutOrderId),
            },
          },
        ]
      : []),
  ]

  return {
    ...store,
    sessions: sessions as unknown as MarkerSpreadingStore['sessions'],
  }
}

export function buildMarkerPlanSummaryBuildOptions(
  progressRecords: CuttingOrderProgressRecord[] = cuttingOrderProgressRecords,
): CuttingSummaryBuildOptions {
  const productionRows = buildProductionProgressRows(progressRecords)
  const seedOriginalRows = buildOriginalCutOrderViewModel(progressRecords, [], { progressRows: productionRows }).rows
  const mergeBatches: MergeBatchRecord[] = buildSystemSeedMergeBatches(
    buildMarkerPlanSourceMergeBatchItems(seedOriginalRows),
  )
  const originalRows = buildOriginalCutOrderViewModel(progressRecords, mergeBatches, { progressRows: productionRows }).rows
  const materialPrepRows = buildMaterialPrepViewModel(progressRecords, mergeBatches, { pickupWritebacks: [] }).rows
  const markerStore = buildMarkerPlanSeedMarkerStore({
    originalRows,
    mergeBatches,
  })

  return {
    productionRows,
    originalRows,
    materialPrepRows,
    mergeBatches,
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
  const sources = buildMarkerPlanSummaryBuildOptions(snapshot.progressRecords)
  const storedPlans = readStoredMarkerPlans()
  return {
    snapshot,
    sources,
    storedPlans,
    viewModel: buildMarkerPlanViewModel(sources, storedPlans),
  }
}
