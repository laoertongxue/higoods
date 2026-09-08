import { listMaterialPrepOrderProjections } from './production-material-prep.ts'
import { listGeneratedCutOrderSourceRecords } from './generated-cut-orders.ts'
import {
  listMaterialLedgerProjections,
  type MaterialLedgerProjection,
} from './material-ledger.ts'
import {
  listCuttingRuntimeEventsByInventoryScope,
  listCuttingRuntimeEventsByType,
  type CuttingRuntimeEvent,
} from './cutting-runtime-event-ledger.ts'
import type { SpreadingOrder } from '../../../pages/process-factory/cutting/marker-spreading-model.ts'

export type SpreadingMaterialReadinessStatusKey =
  | 'READY'
  | 'NOT_CLAIMED'
  | 'SHORTAGE'

export interface SpreadingMaterialReadinessSourceRow {
  cutOrderId: string
  cutOrderNo: string
  productionOrderNo: string
  materialSku: string
  materialName: string
  materialColor: string
  claimedQty: number
  consumedQty: number
  returnedQty: number
  availableQty: number
  unit: string
}

export interface SpreadingMaterialReadiness {
  statusKey: SpreadingMaterialReadinessStatusKey
  statusLabel: string
  statusClassName: string
  canStartSpreading: boolean
  plannedUsageQty: number
  claimedQty: number
  consumedQty: number
  returnedQty: number
  availableQty: number
  shortageQty: number
  unit: string
  reasonText: string
  sourceRows: SpreadingMaterialReadinessSourceRow[]
}

export interface SpreadingMaterialReadinessInput {
  sourceCutOrderIds?: string[]
  sourceCutOrderNos?: string[]
  plannedMaterialUsage?: number
  plannedMaterialUsageUnit?: string
}

const READY_CLASS = 'border-emerald-200 bg-emerald-50 text-emerald-700'
const WARNING_CLASS = 'border-amber-200 bg-amber-50 text-amber-700'
const DANGER_CLASS = 'border-rose-200 bg-rose-50 text-rose-700'

function roundQty(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

function runtimeRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
}

function runtimeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function runtimeNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function getRuntimeWaitProcessQty(event: CuttingRuntimeEvent): number {
  const payload = runtimeRecord(event.payload)
  if (event.inventoryEffect?.qty) return event.inventoryEffect.qty
  return runtimeNumber(payload.pickupQty)
    || runtimeNumber(payload.receivedQty)
    || runtimeNumber(payload.issuedQty)
    || runtimeNumber(payload.returnedQty)
}

function listRuntimeWaitProcessEvents(): CuttingRuntimeEvent[] {
  const events = [
    ...listCuttingRuntimeEventsByType('中转仓接收'),
    ...listCuttingRuntimeEventsByInventoryScope('裁床待加工仓'),
  ]
  const seen = new Set<string>()
  return events
    .filter((event) => {
      if (!event.eventId || seen.has(event.eventId) || event.eventStatus === '已取消') return false
      seen.add(event.eventId)
      return true
    })
}

function cloneLedgerRow(row: MaterialLedgerProjection): MaterialLedgerProjection {
  return {
    ...row,
    materialIdentity: { ...row.materialIdentity },
    patternIdentity: {
      ...row.patternIdentity,
      piecePartCodes: [...row.patternIdentity.piecePartCodes],
      piecePartNames: [...row.patternIdentity.piecePartNames],
    },
    events: row.events.map((event) => ({ ...event })),
  }
}

function isRuntimeEventForLedgerRow(event: CuttingRuntimeEvent, row: MaterialLedgerProjection): boolean {
  const payload = runtimeRecord(event.payload)
  const materialSku = event.material?.materialSku || runtimeString(payload.materialSku)
  if (event.refs.cutOrderId) return event.refs.cutOrderId === row.cutOrderId
  // Old pickup writes used the production number in cutOrderNo; only that known alias falls through.
  if (event.refs.cutOrderNo && event.refs.cutOrderNo !== event.refs.productionOrderNo) return event.refs.cutOrderNo === row.cutOrderNo
  if (event.refs.productionOrderNo !== row.productionOrderNo || materialSku !== row.materialIdentity.materialSku) return false
  const sources = listGeneratedCutOrderSourceRecords()
  const source = sources.find(cut => cut.cutOrderId === row.cutOrderId)
  const locations = Array.isArray(payload.warehouseLocations) ? payload.warehouseLocations.map(runtimeRecord) : []
  if (source?.cuttingTaskAssigneeFactoryId && locations.length
    && locations.some(location => location.factoryId !== source.cuttingTaskAssigneeFactoryId)) return false
  const prepLineId = runtimeString(payload.prepLineId)
  if (prepLineId) return Boolean(source && (source.sourceBomItemIds || []).some(bomId =>
    prepLineId === `prep-order-${source.productionOrderId}:${source.techPackVersionId}:${bomId}`))
  // Historical receipts lacking a BOM identity cannot credit several material branches.
  return sources.filter(cut => cut.productionOrderNo === row.productionOrderNo && cut.materialSku === materialSku).length === 1
}

function buildRuntimeAdjustedLedgerRows(): MaterialLedgerProjection[] {
  const rows = listMaterialLedgerProjections().map(cloneLedgerRow)
  const runtimeEvents = listRuntimeWaitProcessEvents()
  const prepByOrder = new Map(listMaterialPrepOrderProjections().map(prep => [prep.order.productionOrderId, prep]))
  return rows.map((originalRow) => {
    const prep = prepByOrder.get(originalRow.productionOrderId)
    const prepLines = prep?.lines.filter(line => line.runtimeBomLine && line.cutOrderId === originalRow.cutOrderId
      && line.materialSku === originalRow.materialIdentity.materialSku && line.unit === originalRow.unit) || []
    const prepLine = prepLines.length === 1 ? prepLines[0] : null
    const row = prepLine ? { ...originalRow, requiredMaterialQty: prepLine.requiredQty,
      transferWarehouseAllocatedQty: prepLine.confirmedPrepQty } : originalRow
    const matchedEvents = runtimeEvents.filter((event) => isRuntimeEventForLedgerRow(event, row))
    if (!matchedEvents.length) return row
    let cuttingClaimedQty = row.cuttingClaimedQty
    let spreadingConsumedQty = row.spreadingConsumedQty
    let returnedQty = row.returnedQty
    let availableQty = row.availableQty

    matchedEvents.forEach((event) => {
      const qty = getRuntimeWaitProcessQty(event)
      if (qty <= 0) return
      const payload = runtimeRecord(event.payload)
      const unit = event.inventoryEffect?.unit || event.material?.unit || runtimeString(payload.unit)
      if (unit !== row.unit) {
        // Recover the original unit only from this exact saved pickup allocation, never from plan quantity.
        const pickup = prep?.pickupRecords.find(record => record.pickupRecordId === payload.pickupRecordId
          && record.prepLineId === payload.prepLineId && record.productionOrderId === row.productionOrderId)
        const allocations = pickup?.sourceAllocations || []
        const provenLegacyUnit = event.eventType === '中转仓接收' && event.refs.cutOrderNo === event.refs.productionOrderNo
          && prepLine?.prepLineId === payload.prepLineId && allocations.length > 0
          && allocations.every(allocation => allocation.prepLineId === prepLine?.prepLineId && allocation.unit === row.unit)
          && roundQty(allocations.reduce((sum, allocation) => sum + allocation.pickedQty, 0)) === roundQty(qty)
        if (!provenLegacyUnit) return
      }
      if (event.eventType === '中转仓接收') {
        cuttingClaimedQty += qty
        availableQty += qty
      }
      if (event.eventType === '待加工仓加工接收') {
        spreadingConsumedQty += qty
        availableQty -= qty
      }
      if (event.eventType === '待加工仓回收入仓' || event.eventType === '待加工仓扫码入仓') {
        returnedQty += event.eventType === '待加工仓回收入仓' ? qty : 0
        availableQty += qty
      }
    })

    return {
      ...row,
      cuttingClaimedQty: roundQty(cuttingClaimedQty),
      spreadingConsumedQty: roundQty(spreadingConsumedQty),
      returnedQty: roundQty(returnedQty),
      availableQty: roundQty(Math.max(availableQty, 0)),
    }
  })
}

export function buildRuntimeAdjustedLedgerMap(): Record<string, MaterialLedgerProjection> {
  const map: Record<string, MaterialLedgerProjection> = {}
  buildRuntimeAdjustedLedgerRows().forEach((row) => {
    map[row.cutOrderId] = row
    map[row.cutOrderNo] = row
  })
  return map
}

function resolveLedgerRows(input: SpreadingMaterialReadinessInput, map = buildRuntimeAdjustedLedgerMap()): MaterialLedgerProjection[] {
  const keys = [...(input.sourceCutOrderIds || []), ...(input.sourceCutOrderNos || [])]
  const seen = new Set<string>()
  return keys
    .map((key) => map[key])
    .filter((row): row is MaterialLedgerProjection => {
      if (!row || seen.has(row.cutOrderId)) return false
      seen.add(row.cutOrderId)
      return true
    })
}

function buildReasonText(input: {
  statusKey: SpreadingMaterialReadinessStatusKey
  plannedUsageQty: number
  availableQty: number
  shortageQty: number
  unit: string
}): string {
  const planned = `${input.plannedUsageQty.toFixed(2)} ${input.unit}`
  const available = `${input.availableQty.toFixed(2)} ${input.unit}`
  const shortage = `${input.shortageQty.toFixed(2)} ${input.unit}`
  if (input.statusKey === 'READY') return `计划用量 ${planned}，当前可用 ${available}，可开始铺布。`
  if (input.statusKey === 'NOT_CLAIMED') return '来源裁片单尚未完成裁床接收，不能开始铺布。'
  if (input.plannedUsageQty <= 0) return '铺布单缺少计划用量，不能开始铺布。'
  if (input.statusKey === 'SHORTAGE') return `计划用量 ${planned}，当前可用 ${available}，缺口 ${shortage}，不能开始铺布。`
  return ''
}

export function resolveSpreadingMaterialReadiness(
  input: SpreadingMaterialReadinessInput,
  ledgerMap?: Record<string, MaterialLedgerProjection>,
): SpreadingMaterialReadiness {
  const sourceRows = resolveLedgerRows(input, ledgerMap)
  const plannedUsageQty = roundQty(Math.max(Number(input.plannedMaterialUsage || 0), 0))
  const unit = input.plannedMaterialUsageUnit || sourceRows[0]?.unit || '米'
  const claimedQty = roundQty(sourceRows.reduce((sum, row) => sum + Number(row.cuttingClaimedQty || 0), 0))
  const consumedQty = roundQty(sourceRows.reduce((sum, row) => sum + Number(row.spreadingConsumedQty || 0), 0))
  const returnedQty = roundQty(sourceRows.reduce((sum, row) => sum + Number(row.returnedQty || 0), 0))
  const availableQty = roundQty(sourceRows.reduce((sum, row) => sum + Number(row.availableQty || 0), 0))
  const shortageQty = roundQty(Math.max(plannedUsageQty - availableQty, 0))

  let statusKey: SpreadingMaterialReadinessStatusKey = 'SHORTAGE'
  if (claimedQty <= 0) statusKey = 'NOT_CLAIMED'
  else if (plannedUsageQty > 0 && availableQty >= plannedUsageQty) statusKey = 'READY'

  const meta: Record<SpreadingMaterialReadinessStatusKey, { label: string; className: string }> = {
    READY: { label: '可铺布', className: READY_CLASS },
    NOT_CLAIMED: { label: '未接收', className: WARNING_CLASS },
    SHORTAGE: { label: '物料不足', className: DANGER_CLASS },
  }
  const reasonText = buildReasonText({ statusKey, plannedUsageQty, availableQty, shortageQty, unit })

  return {
    statusKey,
    statusLabel: meta[statusKey].label,
    statusClassName: meta[statusKey].className,
    canStartSpreading: statusKey === 'READY',
    plannedUsageQty,
    claimedQty,
    consumedQty,
    returnedQty,
    availableQty,
    shortageQty,
    unit,
    reasonText,
    sourceRows: sourceRows.map((row) => ({
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      productionOrderNo: row.productionOrderNo,
      materialSku: row.materialIdentity.materialSku,
      materialName: row.materialIdentity.materialName,
      materialColor: row.materialIdentity.materialColor,
      claimedQty: roundQty(row.cuttingClaimedQty),
      consumedQty: roundQty(row.spreadingConsumedQty),
      returnedQty: roundQty(row.returnedQty),
      availableQty: roundQty(row.availableQty),
      unit: row.unit || unit,
    })),
  }
}

export function resolveSpreadingOrderMaterialReadiness(order: SpreadingOrder, ledgerMap?: Record<string, MaterialLedgerProjection>): SpreadingMaterialReadiness {
  return resolveSpreadingMaterialReadiness({
    sourceCutOrderIds: order.sourceCutOrderIds,
    sourceCutOrderNos: order.sourceCutOrderNos,
    plannedMaterialUsage: order.plannedMaterialUsage,
    plannedMaterialUsageUnit: order.plannedMaterialUsageUnit,
  }, ledgerMap)
}
