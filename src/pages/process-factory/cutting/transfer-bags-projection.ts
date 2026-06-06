import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  applyPocketBindingLocksToTicketRecords,
  buildSystemSeedTransferBagStore,
  buildTransferBagViewModel,
  mergeTransferBagStores,
  type TransferBagStore,
} from './transfer-bags-model.ts'
import {
  buildTransferBagReturnViewModel,
} from './transfer-bag-return-model.ts'
import {
  buildSystemSeedFeiTicketLedger,
  type FeiTicketLabelRecord,
} from './fei-tickets-model.ts'
import {
  buildCutOrderViewModel,
  type CutOrderRow,
} from './cut-orders-model.ts'
import {
  buildProductionProgressRows,
} from './production-progress-model.ts'
import {
  readStoredMarkerPlanOccupancyLookup,
} from './marker-plan-occupancy.ts'
import type {
  MarkerPlanSourceItem,
  MarkerPlanSourceRecord,
  MarkerPlanSourceStatus,
} from './marker-plan-source-model.ts'
import type { MarkerSpreadingStore } from './marker-spreading-model.ts'

const emptyCraftTraceProjection = {
  items: [],
  itemsByTicketId: {},
  itemsByTicketNo: {},
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
    sourceStageLabel: row.currentStage.label,
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
      const createdAtDate = parseMarkerPlanSourceDate(record.markerPlanNo)
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
        plannedCuttingDate: createdAtDate,
        note: '来源于裁片 runtime 主源聚合。',
        createdFrom: 'system-seed' as const,
        createdAt: createdAtDate ? `${createdAtDate} 09:00` : '',
        updatedAt: createdAtDate ? `${createdAtDate} 09:00` : '',
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

function buildTransferBagCutOrderRows(
  snapshot: CuttingDomainSnapshot,
  markerPlanSources: MarkerPlanSourceRecord[],
  progressRows: ReturnType<typeof buildProductionProgressRows>,
): CutOrderRow[] {
  return buildCutOrderViewModel(snapshot.progressRecords, markerPlanSources, {
    progressRows,
    markerPlanOccupancy: readStoredMarkerPlanOccupancyLookup(),
  }).rows
}

function buildTransferBagTicketRecords(input: {
  snapshot: CuttingDomainSnapshot
  cutOrderRows: CutOrderRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
  markerStore: MarkerSpreadingStore
}): FeiTicketLabelRecord[] {
  const systemLedger = buildSystemSeedFeiTicketLedger({
    cutOrderRows: input.cutOrderRows,
    materialPrepRows: [],
    markerPlanSources: input.markerPlanSources,
    markerStore: input.markerStore,
  })
  return mergeByKey(
    systemLedger.ticketRecords,
    input.snapshot.feiTicketState.ticketRecords as unknown as FeiTicketLabelRecord[],
    'ticketRecordId',
  )
}

export function buildTransferBagsProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
  storeOverride?: TransferBagStore,
) {
  const progressRows = buildProductionProgressRows(snapshot.progressRecords, {
    pickupEvents: snapshot.pdaExecutionState.pickupEvents as never[],
    inboundEvents: snapshot.pdaExecutionState.inboundEvents as never[],
    handoverEvents: snapshot.pdaExecutionState.handoverEvents as never[],
    replenishmentFeedbackEvents: snapshot.pdaExecutionState.replenishmentFeedbackEvents as never[],
  })
  const seedCutOrderRows = buildTransferBagCutOrderRows(snapshot, [], progressRows)
  const markerPlanSources = buildRuntimeMarkerPlanSourceRecords(snapshot, seedCutOrderRows)
  const cutOrderRows = buildTransferBagCutOrderRows(snapshot, markerPlanSources, progressRows)
  const markerStore = snapshot.markerSpreadingState.store as unknown as MarkerSpreadingStore
  const rawTicketRecords = buildTransferBagTicketRecords({
    snapshot,
    cutOrderRows,
    markerPlanSources,
    markerStore,
  })
  const seedTransferBagStore = buildSystemSeedTransferBagStore({
    cutOrderRows,
    ticketRecords: rawTicketRecords,
    markerPlanSources,
  })
  const transferBagStore = storeOverride
    ? mergeTransferBagStores(seedTransferBagStore, storeOverride)
    : mergeTransferBagStores(seedTransferBagStore, snapshot.transferBagState.store as unknown as TransferBagStore)
  const ticketRecords = applyPocketBindingLocksToTicketRecords(rawTicketRecords, transferBagStore)
  const transferBagViewModel = buildTransferBagViewModel({
    cutOrderRows,
    ticketRecords,
    markerPlanSources,
    store: transferBagStore,
    includeStageDerived: false,
  })
  const transferBagReturnViewModel = buildTransferBagReturnViewModel({
    store: transferBagStore,
    baseViewModel: transferBagViewModel,
  })

  return {
    snapshot,
    ticketRecords,
    store: transferBagStore,
    viewModel: transferBagViewModel,
    returnViewModel: transferBagReturnViewModel,
    craftTraceProjection: emptyCraftTraceProjection,
  }
}

export function buildCarrierCycleProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
  carrierId: string,
  cycleId?: string,
  storeOverride?: TransferBagStore,
) {
  const projection = buildTransferBagsProjection(snapshot, storeOverride)
  const carrier = projection.store.masters.find((item) => item.carrierId === carrierId) || null
  const cycles = projection.store.usages.filter((item) => item.carrierId === carrierId)
  const cycle =
    (cycleId
      ? cycles.find((item) => item.cycleId === cycleId)
      : cycles.find((item) => item.cycleId === carrier?.currentCycleId)) ||
    cycles[0] ||
    null
  const bindings = cycle ? projection.store.bindings.filter((item) => item.cycleId === cycle.cycleId) : []
  const manifests = cycle ? projection.store.manifests.filter((item) => item.cycleId === cycle.cycleId) : []
  const craftTraceItems = bindings
    .map((binding) => projection.craftTraceProjection.itemsByTicketId[binding.feiTicketId] || null)
    .filter(Boolean)

  return {
    ...projection,
    carrier,
    cycle,
    bindings,
    manifests,
    craftTraceItems,
  }
}
