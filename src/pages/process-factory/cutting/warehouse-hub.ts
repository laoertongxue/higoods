import {
  type HandoverPickingTask,
  type HandoverPickingTaskProjection,
  type SewingTaskAllocationProjection,
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildSewingTaskAllocationProjectionFromInventory,
} from '../../../data/fcs/cutting/sewing-dispatch.ts'
import {
  listSpreadingResultGeneratedFeiTickets,
  type GeneratedFeiTicketSourceRecord,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import {
  getFeiTicketNumberingStatus,
  validateFeiTicketNumberingBeforeBagging,
} from '../../../data/fcs/cutting/fei-ticket-numbering.ts'
import {
  listHandoverRecords,
  type SpecialCraftHandoverGroup,
  type SpecialCraftReturnInventoryRecord,
  type SpecialCraftReturnProjection,
  type SpecialCraftReturnRecord,
} from '../../../data/fcs/cutting/handover-orders.ts'
import {
  listMaterialLedgerProjections,
  cuttingMaterialLedgerEventTypeLabels,
  type CuttingMaterialLedgerEventType,
  type CuttingMaterialLedgerEvent,
  type MaterialLedgerProjection,
} from '../../../data/fcs/cutting/material-ledger.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import {
  appendCuttingRuntimeEvent,
  listCuttingRuntimeEventsByInventoryScope,
  listCuttingRuntimeEventsByType,
  type CuttingRuntimeEvent,
  type TransferPickupPayload,
  type WaitProcessIssuePayload,
  type WaitProcessReturnPayload,
  type HandoverRecordSubmitPayload,
} from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderCompactKpiCard, renderStickyTableScroller } from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'
import {
  buildInboundTempBagInventoryRecords,
  buildInboundTempBagsFromTransferBagViewModel,
  type InboundTempBag,
  type InboundTempBagContainedFeiTicket,
  type InboundTempBagInventoryRecord,
  type TransferBagTicketCandidate,
} from './transfer-bags-model.ts'
import { buildTransferBagsProjection } from './transfer-bags-projection.ts'
import { getWarehouseSearchParams } from './warehouse-shared.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import {
  renderWarehouseFlowButton,
  renderWarehouseLocationActions,
  renderWarehouseLocationToolbar,
  type FactoryWarehouseFlowLine,
} from '../shared/warehouse-standard.ts'
import {
  appendWaitHandoverHandoverRecordEvent,
  appendWaitHandoverInboundEvent,
  appendWaitHandoverBaggingConfirmEvent,
  buildWaitHandoverRuntimeTicketFromGeneratedTicket,
  runtimeEventHasWaitHandoverTicket,
} from './wait-handover-runtime.ts'

type WaitProcessTabKey = 'inventory' | 'claimRecords' | 'usage' | 'returns' | 'locations'
type WaitProcessWarehouseAction = 'claim' | 'process-issue' | 'return'

const waitProcessStockFlowEventTypes: CuttingMaterialLedgerEventType[] = [
  'CUTTING_WAIT_PROCESS_INBOUNDED',
  'SPREADING_ACTUAL_CONSUMED',
  'CUTTING_RETURNED',
]
type WaitHandoverTabKey =
  | 'inventory'
  | 'inbound-bagging'
  | 'handover-bagging'
  | 'special-craft-return'
  | 'locations'

interface WaitProcessFilterState {
  keyword: string
  stockStatus: string
  locationArea: string
  operatorName: string
  eventType: string
  dateFrom: string
  dateTo: string
}

interface WaitHandoverFilterState {
  keyword: string
  stockStatus: string
  locationArea: string
  specialCraftStatus: string
  receiverName: string
  eventType: string
  dateFrom: string
  dateTo: string
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}

function formatLength(value: number, unit = '米'): string {
  return `${formatNumber(value)} ${unit}`
}

function estimateMaterialRollCount(quantity: number): number {
  if (quantity <= 0) return 0
  return Math.max(Math.ceil(quantity / 280), 1)
}

function formatMaterialQtyWithRolls(quantity: number, unit = '米'): string {
  return `${formatLength(quantity, unit)} / ${estimateMaterialRollCount(quantity)} 卷`
}

function getWaitProcessFilters(): WaitProcessFilterState {
  const params = getWarehouseSearchParams()
  return {
    keyword: (params.get('q') || '').trim(),
    stockStatus: params.get('stockStatus') || '全部',
    locationArea: params.get('locationArea') || '全部',
    operatorName: (params.get('operatorName') || '').trim(),
    eventType: params.get('eventType') || '全部',
    dateFrom: params.get('dateFrom') || '',
    dateTo: params.get('dateTo') || '',
  }
}

function getWaitHandoverFilters(): WaitHandoverFilterState {
  const params = getWarehouseSearchParams()
  return {
    keyword: (params.get('q') || '').trim(),
    stockStatus: params.get('stockStatus') || '全部',
    locationArea: params.get('locationArea') || '全部',
    specialCraftStatus: params.get('specialCraftStatus') || '全部',
    receiverName: (params.get('receiverName') || '').trim(),
    eventType: params.get('eventType') || '全部',
    dateFrom: params.get('dateFrom') || '',
    dateTo: params.get('dateTo') || '',
  }
}

function normalizeSearchText(value: string | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function includesKeyword(values: Array<string | undefined>, keyword: string): boolean {
  const normalizedKeyword = normalizeSearchText(keyword)
  if (!normalizedKeyword) return true
  return values.some((value) => normalizeSearchText(value).includes(normalizedKeyword))
}

function getEventDateValue(occurredAt: string): string {
  return occurredAt.slice(0, 10)
}

function getWaitProcessEventTypeLabel(eventType: CuttingMaterialLedgerEventType): string {
  if (eventType === 'TRANSFER_WAREHOUSE_ALLOCATED') return '中转仓已配料'
  if (eventType === 'CUTTING_CLAIMED') return '中转仓领料'
  if (eventType === 'CUTTING_WAIT_PROCESS_INBOUNDED') return '中转仓领料入库'
  if (eventType === 'SPREADING_ACTUAL_CONSUMED') return '加工领料'
  if (eventType === 'CUTTING_RETURNED') return '回收入仓'
  return cuttingMaterialLedgerEventTypeLabels[eventType] || eventType
}

function getWaitProcessFlowStatusLabel(eventType: CuttingMaterialLedgerEventType): string {
  if (eventType === 'TRANSFER_WAREHOUSE_ALLOCATED') return '中转仓已配料'
  if (eventType === 'CUTTING_CLAIMED') return '中转仓领料记录'
  if (eventType === 'CUTTING_WAIT_PROCESS_INBOUNDED') return '中转仓领料入库记录'
  if (eventType === 'CUTTING_RETURNED') return '回收入仓记录'
  if (eventType === 'SPREADING_ACTUAL_CONSUMED') return '加工领料记录'
  return '库存流水'
}

function getWaitProcessStockDirectionLabel(eventType: CuttingMaterialLedgerEventType): string {
  if (eventType === 'TRANSFER_WAREHOUSE_ALLOCATED') return '中转仓配料'
  if (eventType === 'CUTTING_CLAIMED') return '领料确认'
  if (eventType === 'SPREADING_ACTUAL_CONSUMED') return '减库存'
  if (eventType === 'CUTTING_WAIT_PROCESS_INBOUNDED' || eventType === 'CUTTING_RETURNED') return '加库存'
  return '库存调整'
}

function getWaitProcessStockFlowTypeLabel(eventType: CuttingMaterialLedgerEventType): string {
  if (eventType === 'CUTTING_WAIT_PROCESS_INBOUNDED') return '中转仓领料入库'
  return getWaitProcessEventTypeLabel(eventType)
}

function getReadableWaitProcessSourceObject(sourceObjectId: string, fallbackNo: string): string {
  const raw = String(sourceObjectId || '').trim()
  if (!raw || raw.includes(':')) return fallbackNo
  if (/^PB-/i.test(raw)) return `铺布单 ${raw}`
  if (/^RET-/i.test(raw)) return `回收单 ${raw}`
  if (/^ADJ-/i.test(raw)) return `调整单 ${raw}`
  if (/^MK|^MB-/i.test(raw)) return `唛架方案 ${raw}`
  if (/^WMS-PREP-/i.test(raw)) return `中转仓配料单 ${raw}`
  return raw
}

function getWaitProcessEventSourceLabel(event: CuttingMaterialLedgerEvent): string {
  switch (event.sourceObjectType) {
    case 'WMS_PREP_RECORD':
      return `中转仓已配料：${event.cutOrderNo}`
    case 'PDA_PICKUP_RECORD':
      return `中转仓领料：${event.cutOrderNo}`
    case 'WAIT_PROCESS_INBOUND_RECORD':
      return `中转仓领料入库：${event.cutOrderNo}`
    case 'MARKER_PLAN_DRAFT':
      return event.eventType === 'MARKER_DRAFT_RELEASED'
        ? `草稿释放：${event.cutOrderNo}`
        : `草稿锁定：${event.cutOrderNo}`
    case 'MARKER_PLAN':
      return `唛架确认锁定：${event.cutOrderNo}`
    case 'SPREADING_SESSION':
      return `加工领料：${getReadableWaitProcessSourceObject(event.sourceObjectId, event.cutOrderNo)}`
    case 'RETURN_RECORD':
      return `铺布余料回收入仓：${getReadableWaitProcessSourceObject(event.sourceObjectId, event.cutOrderNo)}`
    case 'ADJUSTMENT_RECORD':
      return `库存调整：${getReadableWaitProcessSourceObject(event.sourceObjectId, event.cutOrderNo)}`
    case 'CUT_ORDER_REQUIREMENT':
    default:
      return `${getWaitProcessEventTypeLabel(event.eventType)}：${event.cutOrderNo}`
  }
}

function getWaitProcessEventSourceDetail(event: CuttingMaterialLedgerEvent): string {
  const parts = [
    `生产单 ${event.productionOrderNo}`,
    event.materialSku ? `面料 ${event.materialSku}` : '',
    event.materialColor ? `颜色 ${event.materialColor}` : '',
  ].filter(Boolean)
  return parts.join(' / ')
}

function toRuntimeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function runtimeNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function runtimeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function listRuntimeWaitProcessEvents(): CuttingRuntimeEvent[] {
  const events = [
    ...listCuttingRuntimeEventsByType('中转仓领料'),
    ...listCuttingRuntimeEventsByInventoryScope('裁床待加工仓'),
  ]
  const seen = new Set<string>()
  return events
    .filter((event) => {
      if (!event.eventId || seen.has(event.eventId)) return false
      seen.add(event.eventId)
      return true
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
}

function isRuntimeEventForLedgerRow(event: CuttingRuntimeEvent, row: MaterialLedgerProjection): boolean {
  const materialSku = event.material?.materialSku || runtimeString(toRuntimeRecord(event.payload).materialSku)
  return [
    event.refs.cutOrderId && event.refs.cutOrderId === row.cutOrderId,
    event.refs.cutOrderNo && event.refs.cutOrderNo === row.cutOrderNo,
    event.refs.productionOrderNo && event.refs.productionOrderNo === row.productionOrderNo && materialSku === row.materialIdentity.materialSku,
    materialSku && materialSku === row.materialIdentity.materialSku && event.refs.productionOrderNo === row.productionOrderNo,
  ].some(Boolean)
}

function getRuntimeWaitProcessQty(event: CuttingRuntimeEvent): number {
  const payload = toRuntimeRecord(event.payload)
  if (event.inventoryEffect?.qty) return event.inventoryEffect.qty
  return runtimeNumber(payload.pickupQty)
    || runtimeNumber(payload.receivedQty)
    || runtimeNumber(payload.issuedQty)
    || runtimeNumber(payload.returnedQty)
}

function getRuntimeWaitProcessRollCount(event: CuttingRuntimeEvent): number {
  const payload = toRuntimeRecord(event.payload)
  return runtimeNumber(event.inventoryEffect?.rollCount) || runtimeNumber(payload.rollCount) || estimateMaterialRollCount(getRuntimeWaitProcessQty(event))
}

function getRuntimeWaitProcessSourceObjectId(event: CuttingRuntimeEvent): string {
  const payload = toRuntimeRecord(event.payload)
  return runtimeString(payload.pickupRecordNo)
    || runtimeString(payload.inboundRecordNo)
    || runtimeString(payload.issueRecordNo)
    || runtimeString(payload.returnRecordNo)
    || event.refs.spreadingOrderNo
    || event.refs.cutOrderNo
    || event.eventType
}

function getRuntimeWaitProcessReadableSource(event: CuttingRuntimeEvent): string {
  const payload = toRuntimeRecord(event.payload)
  if (event.eventType === '中转仓领料') return runtimeString(payload.pickupRecordNo) || '中转仓领料'
  if (event.eventType === '待加工仓扫码入仓') return runtimeString(payload.inboundRecordNo) || '中转仓领料入库'
  if (event.eventType === '待加工仓加工领料') return runtimeString(payload.issueRecordNo) || runtimeString(payload.spreadingOrderNo) || '加工领料'
  if (event.eventType === '待加工仓回收入仓') return runtimeString(payload.returnRecordNo) || runtimeString(payload.spreadingOrderNo) || '回收入仓'
  return event.eventType
}

function getRuntimeWaitProcessLocationParts(event: CuttingRuntimeEvent): { area: string; location: string } {
  const payload = toRuntimeRecord(event.payload)
  if (event.eventType === '待加工仓加工领料') {
    return {
      area: runtimeString(payload.fromWarehouseArea) || event.inventoryEffect?.fromWarehouseArea || '',
      location: runtimeString(payload.fromLocationCode) || event.inventoryEffect?.fromLocationCode || '',
    }
  }
  return {
    area: runtimeString(payload.warehouseArea) || event.inventoryEffect?.toWarehouseArea || event.inventoryEffect?.fromWarehouseArea || '',
    location: runtimeString(payload.locationCode) || event.inventoryEffect?.toLocationCode || event.inventoryEffect?.fromLocationCode || '',
  }
}

function getRuntimeWaitProcessLocationLabel(event: CuttingRuntimeEvent): string {
  if (event.eventType === '中转仓领料') return '待入待加工仓'
  const parts = getRuntimeWaitProcessLocationParts(event)
  return [parts.area, parts.location].filter(Boolean).join(' / ') || '待确认库区 / 待确认库位'
}

function convertRuntimeWaitProcessEventToLedgerEvent(event: CuttingRuntimeEvent, row: MaterialLedgerProjection): CuttingMaterialLedgerEvent | null {
  const typeMap: Partial<Record<CuttingRuntimeEvent['eventType'], CuttingMaterialLedgerEventType>> = {
    中转仓领料: 'CUTTING_CLAIMED',
    待加工仓扫码入仓: 'CUTTING_WAIT_PROCESS_INBOUNDED',
    待加工仓加工领料: 'SPREADING_ACTUAL_CONSUMED',
    待加工仓回收入仓: 'CUTTING_RETURNED',
  }
  const eventType = typeMap[event.eventType]
  if (!eventType) return null
  const sourceObjectType =
    eventType === 'CUTTING_CLAIMED'
      ? 'PDA_PICKUP_RECORD'
      : eventType === 'CUTTING_WAIT_PROCESS_INBOUNDED'
        ? 'WAIT_PROCESS_INBOUND_RECORD'
        : eventType === 'SPREADING_ACTUAL_CONSUMED'
          ? 'SPREADING_SESSION'
          : 'RETURN_RECORD'

  return {
    eventId: event.eventId,
    cutOrderId: row.cutOrderId,
    cutOrderNo: row.cutOrderNo,
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    materialSku: event.material?.materialSku || row.materialIdentity.materialSku,
    materialName: event.material?.materialName || row.materialIdentity.materialName,
    materialColor: event.material?.materialColor || row.materialIdentity.materialColor,
    materialAlias: event.material?.materialAlias || row.materialIdentity.materialAlias,
    patternFileId: row.patternIdentity.patternFileId,
    quantity: getRuntimeWaitProcessQty(event),
    unit: event.inventoryEffect?.unit || event.material?.unit || row.unit,
    eventType,
    sourceObjectType,
    sourceObjectId: getRuntimeWaitProcessSourceObjectId(event),
    occurredAt: event.occurredAt,
    operatorName: event.operatorName,
    remark: `${getRuntimeWaitProcessReadableSource(event)} / ${event.eventStatus} / ${getRuntimeWaitProcessRollCount(event)} 卷`,
  }
}

function buildRuntimeFallbackLedgerRow(event: CuttingRuntimeEvent): MaterialLedgerProjection | null {
  if (!event.material?.materialSku && !event.refs.cutOrderNo) return null
  const payload = toRuntimeRecord(event.payload)
  const cutOrderNo = event.refs.cutOrderNo || runtimeString(payload.cutOrderNo) || '未关联裁片单'
  const productionOrderNo = event.refs.productionOrderNo || runtimeString(payload.productionOrderNo) || '未关联生产单'
  const row: MaterialLedgerProjection = {
    cutOrderId: event.refs.cutOrderId || cutOrderNo,
    cutOrderNo,
    productionOrderId: event.refs.productionOrderId || productionOrderNo,
    productionOrderNo,
    materialIdentity: {
      materialSku: event.material?.materialSku || runtimeString(payload.materialSku) || '未识别面料',
      materialName: event.material?.materialName || runtimeString(payload.materialName) || '未识别面料',
      materialColor: event.material?.materialColor || runtimeString(payload.materialColor) || '待补',
      materialAlias: event.material?.materialAlias || '',
      materialImageUrl: '',
      materialUnit: event.material?.unit || '米',
    },
    patternIdentity: event.pattern
      ? {
          patternFileId: event.pattern.patternFileId,
          patternFileName: event.pattern.patternFileName,
          patternVersion: event.pattern.patternVersion,
          patternKind: '布料纸样',
          effectiveWidthValue: Number.parseFloat(event.pattern.effectiveWidth) || 0,
          effectiveWidthUnit: event.pattern.effectiveWidth.replace(/[0-9.]/g, '') || 'cm',
          piecePartCodes: [],
          piecePartNames: event.pattern.partNames,
        }
      : {
          patternFileId: '未关联纸样',
          patternFileName: '未关联纸样',
          patternVersion: '-',
          patternKind: '布料纸样',
          effectiveWidthValue: 0,
          effectiveWidthUnit: 'cm',
          piecePartCodes: [],
          piecePartNames: [],
        },
    requiredMaterialQty: 0,
    transferWarehouseAllocatedQty: 0,
    cuttingClaimedQty: 0,
    markerLockedQty: 0,
    spreadingConsumedQty: 0,
    returnedQty: 0,
    adjustmentQty: 0,
    availableQty: 0,
    unit: event.inventoryEffect?.unit || event.material?.unit || '米',
    latestClaimEvent: null,
    events: [],
  }
  return row
}

function mergeRuntimeWaitProcessEventsIntoLedgerRows(rows: MaterialLedgerProjection[]): MaterialLedgerProjection[] {
  const runtimeEvents = listRuntimeWaitProcessEvents()
  if (!runtimeEvents.length) return rows
  const matchedEventIds = new Set<string>()

  const mergedRows = rows.map((row) => {
    const matchedEvents = runtimeEvents.filter((event) => isRuntimeEventForLedgerRow(event, row))
    matchedEvents.forEach((event) => matchedEventIds.add(event.eventId))
    const convertedEvents = matchedEvents
      .map((event) => convertRuntimeWaitProcessEventToLedgerEvent(event, row))
      .filter((event): event is CuttingMaterialLedgerEvent => Boolean(event))
    if (!convertedEvents.length) return row

    const pickupQty = convertedEvents
      .filter((event) => event.eventType === 'CUTTING_CLAIMED')
      .reduce((sum, event) => sum + event.quantity, 0)
    const inboundQty = convertedEvents
      .filter((event) => event.eventType === 'CUTTING_WAIT_PROCESS_INBOUNDED')
      .reduce((sum, event) => sum + event.quantity, 0)
    const issueQty = convertedEvents
      .filter((event) => event.eventType === 'SPREADING_ACTUAL_CONSUMED')
      .reduce((sum, event) => sum + event.quantity, 0)
    const returnQty = convertedEvents
      .filter((event) => event.eventType === 'CUTTING_RETURNED')
      .reduce((sum, event) => sum + event.quantity, 0)
    const runtimeHasInventory = inboundQty + issueQty + returnQty > 0
    const runtimeAvailableQty = Math.max(inboundQty + returnQty - issueQty - row.markerLockedQty, 0)
    const mergedEvents = [...convertedEvents, ...row.events]
      .filter((event, index, all) => all.findIndex((item) => item.eventId === event.eventId) === index)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
    const latestClaimEvent =
      mergedEvents.find((event) => event.eventType === 'CUTTING_CLAIMED') ||
      row.latestClaimEvent

    return {
      ...row,
      cuttingClaimedQty: row.cuttingClaimedQty + pickupQty,
      spreadingConsumedQty: row.spreadingConsumedQty + issueQty,
      returnedQty: row.returnedQty + returnQty,
      availableQty: runtimeHasInventory ? runtimeAvailableQty : row.availableQty,
      latestClaimEvent,
      events: mergedEvents,
    }
  })

  const fallbackRows = runtimeEvents
    .filter((event) => !matchedEventIds.has(event.eventId))
    .map((event) => {
      const fallbackRow = buildRuntimeFallbackLedgerRow(event)
      if (!fallbackRow) return null
      const converted = convertRuntimeWaitProcessEventToLedgerEvent(event, fallbackRow)
      if (!converted) return null
      const qty = converted.quantity
      return {
        ...fallbackRow,
        cuttingClaimedQty: converted.eventType === 'CUTTING_CLAIMED' ? qty : 0,
        spreadingConsumedQty: converted.eventType === 'SPREADING_ACTUAL_CONSUMED' ? qty : 0,
        returnedQty: converted.eventType === 'CUTTING_RETURNED' ? qty : 0,
        availableQty: converted.eventType === 'CUTTING_WAIT_PROCESS_INBOUNDED' || converted.eventType === 'CUTTING_RETURNED' ? qty : 0,
        latestClaimEvent: converted.eventType === 'CUTTING_CLAIMED' ? converted : null,
        events: [converted],
      }
    })
    .filter((row): row is MaterialLedgerProjection => Boolean(row))

  return [...mergedRows, ...fallbackRows]
}

function buildWaitProcessMaterialLedgerSummary() {
  const rows = mergeRuntimeWaitProcessEventsIntoLedgerRows(listMaterialLedgerProjections())
  const unit = rows[0]?.unit || '米'
  const requiredQty = rows.reduce((sum, item) => sum + Number(item.requiredMaterialQty || 0), 0)
  const configuredQty = rows.reduce((sum, item) => sum + Number(item.transferWarehouseAllocatedQty || 0), 0)
  const claimedQty = rows.reduce((sum, item) => sum + Number(item.cuttingClaimedQty || 0), 0)
  const lockedQty = rows.reduce((sum, item) => sum + Number(item.markerLockedQty || 0), 0)
  const consumedQty = rows.reduce((sum, item) => sum + Number(item.spreadingConsumedQty || 0), 0)
  const availableQty = rows.reduce((sum, item) => sum + Number(item.availableQty || 0), 0)
  const latestClaimEvent = rows
    .map((item) => item.latestClaimEvent)
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))[0] || null

  return {
    requiredQty,
    configuredQty,
    claimedQty,
    lockedQty,
    consumedQty,
    availableQty,
    unit,
    rows,
    latestClaimEvent,
  }
}

interface WaitProcessInventoryItem {
  row: MaterialLedgerProjection
  statusLabel: string
  statusClassName: string
  locationLabel: string
}

interface WaitProcessPendingClaimItem {
  row: MaterialLedgerProjection
  pendingQty: number
  claimStatusLabel: string
  latestPrepEvent: CuttingMaterialLedgerEvent | null
}

function buildWaitProcessInventoryItems(rows: MaterialLedgerProjection[]): WaitProcessInventoryItem[] {
  return rows
    .sort((left, right) =>
      right.availableQty - left.availableQty ||
      getWaitProcessInboundQty(right) - getWaitProcessInboundQty(left) ||
      left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN'),
    )
    .map((row) => {
      const inboundQty = getWaitProcessInboundQty(row)
      const statusLabel =
        inboundQty <= 0
          ? '未入待加工仓'
          : row.availableQty <= 0
            ? '无可用余额'
            : row.markerLockedQty > 0
              ? '部分锁定'
              : '在库可用'
      const statusClassName =
        statusLabel === '在库可用'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : statusLabel === '部分锁定'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : statusLabel === '无可用余额'
              ? 'border-slate-200 bg-slate-50 text-slate-600'
              : 'border-amber-200 bg-amber-50 text-amber-700'
      return {
        row,
        statusLabel,
        statusClassName,
        locationLabel: buildWaitProcessInventoryLocationLabel(row),
      }
    })
}

function filterWaitProcessInventoryItems(
  items: WaitProcessInventoryItem[],
  filters: WaitProcessFilterState,
): WaitProcessInventoryItem[] {
  return items.filter(({ row, statusLabel, locationLabel }) => {
    const keywordMatched = includesKeyword(
      [
        row.cutOrderNo,
        row.productionOrderNo,
        row.materialIdentity.materialSku,
        row.materialIdentity.materialName,
        row.materialIdentity.materialColor,
        row.materialIdentity.materialAlias,
        row.patternIdentity.patternFileName,
        row.patternIdentity.patternVersion,
      ],
      filters.keyword,
    )
    const statusMatched = filters.stockStatus === '全部' || statusLabel === filters.stockStatus
    const locationMatched = filters.locationArea === '全部' || locationLabel.includes(filters.locationArea)
    return keywordMatched && statusMatched && locationMatched
  })
}

function getWaitProcessInboundEvents(row: MaterialLedgerProjection): CuttingMaterialLedgerEvent[] {
  return row.events
    .filter((event) => event.eventType === 'CUTTING_WAIT_PROCESS_INBOUNDED')
    .slice()
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
}

function getWaitProcessInboundQty(row: MaterialLedgerProjection): number {
  return getWaitProcessInboundEvents(row).reduce((sum, event) => sum + Number(event.quantity || 0), 0)
}

function getWaitProcessLatestInboundEvent(row: MaterialLedgerProjection): CuttingMaterialLedgerEvent | null {
  return getWaitProcessInboundEvents(row)[0] || null
}

function findRuntimeWaitProcessEventByLedgerEvent(event: CuttingMaterialLedgerEvent): CuttingRuntimeEvent | undefined {
  return listRuntimeWaitProcessEvents().find((runtimeEvent) => runtimeEvent.eventId === event.eventId)
}

function getWaitProcessLedgerEventLocationLabel(event: CuttingMaterialLedgerEvent): string {
  const runtimeEvent = findRuntimeWaitProcessEventByLedgerEvent(event)
  if (runtimeEvent) return getRuntimeWaitProcessLocationLabel(runtimeEvent)
  if (event.eventType === 'CUTTING_CLAIMED') return '待入待加工仓'
  return '待确认库区 / 待确认库位'
}

function buildWaitProcessInventoryLocationLabel(row: MaterialLedgerProjection): string {
  const latestStockLocationEvent = row.events
    .filter((event) => event.eventType === 'CUTTING_WAIT_PROCESS_INBOUNDED' || event.eventType === 'CUTTING_RETURNED')
    .slice()
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))[0]
  if (latestStockLocationEvent) return getWaitProcessLedgerEventLocationLabel(latestStockLocationEvent)
  return '待入待加工仓'
}

function buildWaitProcessFlowLines(row: MaterialLedgerProjection): FactoryWarehouseFlowLine[] {
  return row.events
    .slice()
    .filter((event) => waitProcessStockFlowEventTypes.includes(event.eventType))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
    .map((event) => ({
      flowType: getWaitProcessStockFlowTypeLabel(event.eventType),
      qtyText: formatMaterialQtyWithRolls(event.quantity, event.unit),
      sourceNo: `${getWaitProcessEventSourceLabel(event)} / ${getWaitProcessEventSourceDetail(event)}`,
      operatedAt: event.occurredAt,
      operatorName: event.operatorName,
      statusText: `${getWaitProcessFlowStatusLabel(event.eventType)} / ${getWaitProcessStockDirectionLabel(event.eventType)}`,
    }))
}

function buildWaitProcessTransferClaimFlowLines(row: MaterialLedgerProjection): FactoryWarehouseFlowLine[] {
  return row.events
    .slice()
    .filter((event) => event.eventType === 'TRANSFER_WAREHOUSE_ALLOCATED')
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
    .map((event) => ({
      flowType: getWaitProcessEventTypeLabel(event.eventType),
      qtyText: formatMaterialQtyWithRolls(event.quantity, event.unit),
      sourceNo: `${getWaitProcessEventSourceLabel(event)} / ${getWaitProcessEventSourceDetail(event)}`,
      operatedAt: event.occurredAt,
      operatorName: event.operatorName,
      statusText: getWaitProcessFlowStatusLabel(event.eventType),
    }))
}

function buildWaitProcessInventoryDetailHref(inventoryId: string | undefined): string {
  const params = getWarehouseSearchParams()
  params.set('tab', 'inventory')
  if (inventoryId) params.set('inventoryDetail', inventoryId)
  else params.delete('inventoryDetail')
  const query = params.toString()
  return `${getCanonicalCuttingPath('warehouse-management-wait-process')}${query ? `?${query}` : ''}`
}

function renderWaitProcessInventoryDetailButton(row: MaterialLedgerProjection): string {
  return `
    <button
      type="button"
      class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
      data-nav="${escapeHtml(buildWaitProcessInventoryDetailHref(row.cutOrderId))}"
    >库存明细</button>
  `
}

function buildWaitProcessInventoryLocationMap(items: WaitProcessInventoryItem[]): Map<string, string> {
  return new Map(items.map((item) => [item.row.cutOrderId, item.locationLabel]))
}

function getWaitProcessEventLocationLabel(
  event: CuttingMaterialLedgerEvent,
  locationByCutOrderId: Map<string, string>,
): string {
  const eventLocation = getWaitProcessLedgerEventLocationLabel(event)
  if (eventLocation !== '待确认库区 / 待确认库位') return eventLocation
  return locationByCutOrderId.get(event.cutOrderId) || eventLocation
}

function renderWaitProcessInventoryDetailDialog(items: WaitProcessInventoryItem[]): string {
  const inventoryId = getWarehouseSearchParams().get('inventoryDetail') || ''
  if (!inventoryId) return ''
  const item = items.find((current) => current.row.cutOrderId === inventoryId)
  if (!item) return ''

  const { row, statusLabel, statusClassName, locationLabel } = item
  const closeHref = escapeHtml(buildWaitProcessInventoryDetailHref(undefined))
  const latestInboundEvent = getWaitProcessLatestInboundEvent(row)
  const recentEvents = row.events
    .slice()
    .filter((event) => waitProcessStockFlowEventTypes.includes(event.eventType))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
    .slice(0, 6)
  const rows = recentEvents
    .map((event) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3">${escapeHtml(getWaitProcessEventTypeLabel(event.eventType))}</td>
        <td class="px-3 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialQtyWithRolls(event.quantity, event.unit))}</td>
        <td class="px-3 py-3">
          <div class="font-medium">${escapeHtml(getWaitProcessEventSourceLabel(event))}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(getWaitProcessEventSourceDetail(event))}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(event.remark)}</div>
        </td>
        <td class="px-3 py-3 text-xs">${escapeHtml(getWaitProcessLedgerEventLocationLabel(event))}</td>
        <td class="px-3 py-3">${escapeHtml(event.operatorName)}</td>
        <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(event.occurredAt)}</td>
      </tr>
    `)
    .join('')

  return `
    <div class="fixed inset-0 z-[120]">
      <button class="absolute inset-0 bg-black/45" data-nav="${closeHref}" aria-label="关闭弹窗"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[82vh] w-[min(980px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-foreground">库存明细</h2>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${closeHref}">关闭</button>
        </header>
        <div class="max-h-[68vh] space-y-4 overflow-y-auto p-4">
          <section class="grid gap-3 md:grid-cols-3">
            <article class="rounded-lg border bg-card p-3">
              <div class="text-xs text-muted-foreground">库存状态</div>
              <div class="mt-2"><span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClassName}">${escapeHtml(statusLabel)}</span></div>
              <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(locationLabel)}</div>
            </article>
            <article class="rounded-lg border bg-card p-3">
              <div class="text-xs text-muted-foreground">当前可用</div>
              <div class="mt-2 text-lg font-semibold tabular-nums">${escapeHtml(formatMaterialQtyWithRolls(row.availableQty, row.unit))}</div>
              <div class="mt-1 text-xs text-muted-foreground">裁床已领 ${escapeHtml(formatMaterialQtyWithRolls(row.cuttingClaimedQty, row.unit))}</div>
            </article>
            <article class="rounded-lg border bg-card p-3">
              <div class="text-xs text-muted-foreground">最近中转仓领料</div>
              <div class="mt-2 text-sm font-medium">${escapeHtml(latestInboundEvent ? getWaitProcessEventSourceLabel(latestInboundEvent) : '暂无')}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(latestInboundEvent ? `${latestInboundEvent.occurredAt} / ${latestInboundEvent.operatorName}` : '暂无中转仓领料记录')}</div>
            </article>
          </section>

          <section class="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <article class="rounded-lg border bg-card p-4">
              <h3 class="text-sm font-semibold">面料</h3>
              <div class="mt-3">${renderMaterialIdentityBlock(row.materialIdentity, { compact: true, imageSizeClass: 'h-10 w-10', showCategory: true })}</div>
              <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt class="text-xs text-muted-foreground">面料 SKU</dt><dd class="mt-1 truncate font-medium" title="${escapeHtml(row.materialIdentity.materialSku)}">${escapeHtml(row.materialIdentity.materialSku)}</dd></div>
                <div><dt class="text-xs text-muted-foreground">颜色</dt><dd class="mt-1 truncate font-medium" title="${escapeHtml(row.materialIdentity.materialColor)}">${escapeHtml(row.materialIdentity.materialColor || '待补')}</dd></div>
              </dl>
            </article>
            <article class="rounded-lg border bg-card p-4">
              <h3 class="text-sm font-semibold">库存数量</h3>
              <div class="mt-3">${renderWaitProcessQtyLines(row)}</div>
            </article>
          </section>

          <section class="rounded-lg border bg-card">
            <header class="border-b px-4 py-3">
              <h3 class="text-sm font-semibold">最近流水记录</h3>
            </header>
            <div class="max-h-72 overflow-y-auto">
              <table class="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col class="w-[16%]" />
                  <col class="w-[16%]" />
                  <col class="w-[24%]" />
                  <col class="w-[16%]" />
                  <col class="w-[14%]" />
                  <col class="w-[14%]" />
                </colgroup>
                <thead class="sticky top-0 bg-slate-50 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 font-medium">流水类型</th>
                    <th class="px-3 py-2 font-medium">数量 / 卷数</th>
                    <th class="px-3 py-2 font-medium">来源</th>
                    <th class="px-3 py-2 font-medium">库区 / 库位</th>
                    <th class="px-3 py-2 font-medium">操作人</th>
                    <th class="px-3 py-2 font-medium">时间</th>
                  </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="6" class="px-3 py-8 text-center text-muted-foreground">暂无流水记录</td></tr>'}</tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  `
}

function renderWaitProcessQtyLines(row: MaterialLedgerProjection): string {
  const lines: Array<[string, string, string?]> = [
    ['裁床已领数量', formatMaterialQtyWithRolls(row.cuttingClaimedQty, row.unit), 'text-slate-900'],
    ['已锁定数量', formatMaterialQtyWithRolls(row.markerLockedQty, row.unit), 'text-blue-700'],
    ['已消耗数量', formatMaterialQtyWithRolls(row.spreadingConsumedQty, row.unit), 'text-slate-700'],
    ['可用余额', formatMaterialQtyWithRolls(row.availableQty, row.unit), row.availableQty > 0 ? 'text-emerald-700' : 'text-slate-500'],
  ]
  return `
    <dl class="grid gap-1.5 text-xs">
      ${lines
        .map(([label, value, className]) => `
          <div class="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
            <dt class="text-muted-foreground">${escapeHtml(label)}</dt>
            <dd class="truncate font-medium tabular-nums ${className || ''}" title="${escapeHtml(value)}">${escapeHtml(value)}</dd>
          </div>
        `)
        .join('')}
    </dl>
  `
}

function renderWaitProcessInventoryTable(items: WaitProcessInventoryItem[]): string {
  if (!items.length) {
    return '<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">暂无已领入待加工仓的面料库存。</div>'
  }

  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">待加工仓面料库存</h2>
        <span class="text-xs text-muted-foreground">共 ${items.length} 条库存记录</span>
      </div>
      <div class="max-h-[32rem] overflow-y-auto">
        <table class="w-full table-fixed text-left text-sm">
          <colgroup>
            <col class="w-[15%]" />
            <col class="w-[30%]" />
            <col class="w-[24%]" />
            <col class="w-[18%]" />
            <col class="w-[13%]" />
          </colgroup>
          <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">裁片单</th>
              <th class="px-3 py-2 font-medium">面料</th>
              <th class="px-3 py-2 font-medium">数量账</th>
              <th class="px-3 py-2 font-medium">库位 / 入仓</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(({ row, statusLabel, statusClassName, locationLabel }) => {
                const latestInboundEvent = getWaitProcessLatestInboundEvent(row)
                const inboundQty = getWaitProcessInboundQty(row)
                return `
                <tr class="border-b last:border-b-0">
                  <td class="px-3 py-3 align-top">
                    <div class="min-w-0">
                      <div class="truncate font-medium text-blue-700" title="${escapeHtml(row.cutOrderNo)}">${escapeHtml(row.cutOrderNo)}</div>
                      <div class="mt-1 truncate text-xs text-muted-foreground" title="${escapeHtml(row.productionOrderNo)}">生产单：${escapeHtml(row.productionOrderNo)}</div>
                      <span class="mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClassName}">${escapeHtml(statusLabel)}</span>
                    </div>
                  </td>
                  <td class="px-3 py-3 align-top">
                    ${renderMaterialIdentityBlock(row.materialIdentity, { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false })}
                  </td>
                  <td class="px-3 py-3 align-top">${renderWaitProcessQtyLines(row)}</td>
                  <td class="px-3 py-3 align-top">
                    <div class="min-w-0 text-xs">
                      <div class="truncate font-medium text-foreground" title="${escapeHtml(locationLabel)}">${escapeHtml(locationLabel)}</div>
                      <div class="mt-1 truncate text-muted-foreground" title="${escapeHtml(latestInboundEvent ? `${getWaitProcessEventSourceLabel(latestInboundEvent)} · ${latestInboundEvent.occurredAt} · ${latestInboundEvent.operatorName}` : '暂无中转仓领料记录')}">最近入库：${escapeHtml(latestInboundEvent ? `${latestInboundEvent.occurredAt} · ${latestInboundEvent.operatorName}` : '暂无')}</div>
                      <div class="mt-1 truncate text-muted-foreground">入仓卷数：${estimateMaterialRollCount(inboundQty)} 卷</div>
                    </div>
                  </td>
                  <td class="px-3 py-3 align-top">
                    <div class="flex flex-col gap-2">
                      ${renderWaitProcessInventoryDetailButton(row)}
                      ${renderWarehouseFlowButton(`${row.cutOrderNo} 流水记录`, buildWaitProcessFlowLines(row), '查看流水记录')}
                    </div>
                  </td>
                </tr>
              `})
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function buildWaitProcessPendingClaimItems(rows: MaterialLedgerProjection[]): WaitProcessPendingClaimItem[] {
  return rows
    .map((row) => {
      const pendingQty = Math.max(Number(row.transferWarehouseAllocatedQty || 0) - Number(row.cuttingClaimedQty || 0), 0)
      const latestPrepEvent =
        row.events
          .filter((event) => event.eventType === 'TRANSFER_WAREHOUSE_ALLOCATED')
          .slice()
          .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))[0] || null
      const claimStatusLabel = Number(row.cuttingClaimedQty || 0) > 0 ? '部分已领' : '中转仓待领'
      return { row, pendingQty, claimStatusLabel, latestPrepEvent }
    })
    .filter((item) => item.pendingQty > 0)
    .sort((left, right) =>
      (right.latestPrepEvent?.occurredAt || '').localeCompare(left.latestPrepEvent?.occurredAt || '', 'zh-CN')
      || left.row.productionOrderNo.localeCompare(right.row.productionOrderNo, 'zh-CN'),
    )
}

function filterWaitProcessPendingClaimItems(items: WaitProcessPendingClaimItem[], filters: WaitProcessFilterState): WaitProcessPendingClaimItem[] {
  return items.filter(({ row, latestPrepEvent }) =>
    includesKeyword(
      [
        row.cutOrderNo,
        row.productionOrderNo,
        row.materialIdentity.materialSku,
        row.materialIdentity.materialName,
        row.materialIdentity.materialColor,
        row.materialIdentity.materialAlias,
        latestPrepEvent?.sourceObjectId,
        latestPrepEvent?.remark,
      ],
      filters.keyword,
    ),
  )
}

function renderWaitProcessPendingClaimTable(items: WaitProcessPendingClaimItem[]): string {
  if (!items.length) {
    return '<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">暂无中转仓待领记录。中转仓配好料后会出现在这里，裁床确认中转仓领料后自动移出。</div>'
  }

  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">中转仓待领列表</h2>
        <span class="text-xs text-muted-foreground">共 ${items.length} 条中转仓待领记录</span>
      </div>
      <div class="max-h-[32rem] overflow-y-auto">
        <table class="w-full table-fixed text-left text-sm">
          <colgroup>
            <col class="w-[16%]" />
            <col class="w-[30%]" />
            <col class="w-[20%]" />
            <col class="w-[20%]" />
            <col class="w-[14%]" />
          </colgroup>
          <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">裁片单</th>
              <th class="px-3 py-2 font-medium">面料</th>
              <th class="px-3 py-2 font-medium">待领数量</th>
              <th class="px-3 py-2 font-medium">中转仓配料</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(({ row, pendingQty, claimStatusLabel, latestPrepEvent }) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-3 py-3 align-top">
                    <div class="truncate font-medium text-blue-700" title="${escapeHtml(row.cutOrderNo)}">${escapeHtml(row.cutOrderNo)}</div>
                    <div class="mt-1 truncate text-xs text-muted-foreground" title="${escapeHtml(row.productionOrderNo)}">生产单：${escapeHtml(row.productionOrderNo)}</div>
                    <span class="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">${escapeHtml(claimStatusLabel)}</span>
                  </td>
                  <td class="px-3 py-3 align-top">
                    ${renderMaterialIdentityBlock(row.materialIdentity, { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false })}
                  </td>
                  <td class="px-3 py-3 align-top">
                    <div class="text-sm font-semibold tabular-nums text-amber-700">${escapeHtml(formatMaterialQtyWithRolls(pendingQty, row.unit))}</div>
                    <div class="mt-1 text-xs text-muted-foreground">已配 ${escapeHtml(formatMaterialQtyWithRolls(row.transferWarehouseAllocatedQty, row.unit))}</div>
                    <div class="mt-1 text-xs text-muted-foreground">已领 ${escapeHtml(formatMaterialQtyWithRolls(row.cuttingClaimedQty, row.unit))}</div>
                  </td>
                  <td class="px-3 py-3 align-top text-xs">
                    <div class="truncate font-medium" title="${escapeHtml(latestPrepEvent ? getWaitProcessEventSourceLabel(latestPrepEvent) : '暂无配料记录')}">${escapeHtml(latestPrepEvent ? getWaitProcessEventSourceLabel(latestPrepEvent) : '暂无配料记录')}</div>
                    <div class="mt-1 truncate text-muted-foreground" title="${escapeHtml(latestPrepEvent?.occurredAt || '-')}">配料时间：${escapeHtml(latestPrepEvent?.occurredAt || '-')}</div>
                    <div class="mt-1 truncate text-muted-foreground" title="${escapeHtml(latestPrepEvent?.operatorName || '-')}">操作人：${escapeHtml(latestPrepEvent?.operatorName || '-')}</div>
                  </td>
                  <td class="px-3 py-3 align-top">
                    <div class="flex flex-col gap-2">
                      <button type="button" class="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(buildWaitProcessWarehouseActionHref('claim'))}">中转仓领料</button>
                      ${renderWarehouseFlowButton(`${row.cutOrderNo} 中转仓配料记录`, buildWaitProcessTransferClaimFlowLines(row), '查看配料记录')}
                    </div>
                  </td>
                </tr>
              `)
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderWaitProcessFilterInput(label: string, name: string, value: string, placeholder: string, widthClass = 'w-72'): string {
  return `
    <label class="block shrink-0 ${widthClass}">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <input
        name="${escapeHtml(name)}"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500"
      />
    </label>
  `
}

function renderWaitProcessFilterSelect(
  label: string,
  name: string,
  value: string,
  options: string[],
  widthClass = 'w-44',
): string {
  return `
    <label class="block shrink-0 ${widthClass}">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}" class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500">
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>
    </label>
  `
}

function renderWaitProcessFilterDate(label: string, name: string, value: string): string {
  return `
    <label class="block w-40 shrink-0">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <input
        type="date"
        name="${escapeHtml(name)}"
        value="${escapeHtml(value)}"
        class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500"
      />
    </label>
  `
}

function renderWaitProcessFilterPanel(options: {
  tabKey: WaitProcessTabKey
  filters: WaitProcessFilterState
  inventoryItems: WaitProcessInventoryItem[]
  eventTypes?: CuttingMaterialLedgerEventType[]
}): string {
  const resetHref = buildHubTabHref('warehouse-management-wait-process', options.tabKey)
  const locationOptions = [
    '全部',
    ...Array.from(new Set(options.inventoryItems.map((item) => item.locationLabel.split(' / ')[0]).filter(Boolean))),
  ]
  const operatorOptions = [
    '全部',
    ...Array.from(
      new Set(
        options.inventoryItems
          .flatMap((item) => item.row.events)
          .filter((event) => !options.eventTypes || options.eventTypes.includes(event.eventType))
          .map((event) => event.operatorName)
          .filter(Boolean),
      ),
    ),
  ]

  const controls =
    options.tabKey === 'inventory'
      ? [
          renderWaitProcessFilterInput('面料 / 裁片单', 'q', options.filters.keyword, '面料 SKU、名称、颜色、技术包别名、裁片单'),
          renderWaitProcessFilterSelect('库存状态', 'stockStatus', options.filters.stockStatus, ['全部', '在库可用', '部分锁定', '无可用余额', '未入待加工仓']),
          renderWaitProcessFilterSelect('库区', 'locationArea', options.filters.locationArea, locationOptions),
        ]
      : [
          renderWaitProcessFilterInput('面料 / 裁片单', 'q', options.filters.keyword, '面料 SKU、名称、颜色、裁片单、生产单'),
          renderWaitProcessFilterSelect('操作人', 'operatorName', options.filters.operatorName || '全部', operatorOptions),
          renderWaitProcessFilterDate('开始日期', 'dateFrom', options.filters.dateFrom),
          renderWaitProcessFilterDate('结束日期', 'dateTo', options.filters.dateTo),
        ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <form method="get" action="${escapeHtml(getCanonicalCuttingPath('warehouse-management-wait-process'))}" class="flex flex-nowrap items-end gap-3 overflow-x-auto pb-1">
        <input type="hidden" name="tab" value="${escapeHtml(options.tabKey)}" />
        ${controls.join('')}
        <button type="submit" class="h-10 shrink-0 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">筛选</button>
        <button type="button" data-nav="${escapeHtml(resetHref)}" class="h-10 shrink-0 rounded-md border px-4 text-sm hover:bg-muted">重置</button>
      </form>
    </section>
  `
}

function renderWaitProcessTabs(activeTab: WaitProcessTabKey): string {
  const tabs: Array<{ key: WaitProcessTabKey; label: string }> = [
    { key: 'inventory', label: '库存明细' },
    { key: 'claimRecords', label: '中转仓领料' },
    { key: 'usage', label: '加工领料' },
    { key: 'returns', label: '回收入仓' },
    { key: 'locations', label: '库区库位' },
  ]

  return `
    <nav class="inline-flex max-w-full flex-nowrap gap-1 overflow-x-auto whitespace-nowrap rounded-md bg-muted p-1">
      ${tabs
        .map((tab) => `
          <button
            type="button"
            class="shrink-0 rounded px-3 py-1.5 text-sm ${tab.key === activeTab ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
            data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-process', tab.key))}"
          >
            ${escapeHtml(tab.label)}
          </button>
        `)
        .join('')}
    </nav>
  `
}

function buildWaitProcessWarehouseActionHref(action: WaitProcessWarehouseAction | undefined): string {
  const params = getWarehouseSearchParams()
  if (action) params.set('warehouseAction', action)
  else params.delete('warehouseAction')
  const query = params.toString()
  return `${getCanonicalCuttingPath('warehouse-management-wait-process')}${query ? `?${query}` : ''}`
}

function renderWaitProcessHeaderActions(): string {
  const actions: Array<{ action: WaitProcessWarehouseAction; label: string; primary?: boolean }> = [
    { action: 'claim', label: '中转仓领料', primary: true },
    { action: 'process-issue', label: '加工领料' },
    { action: 'return', label: '回收入仓' },
  ]

  return `
    <div class="flex flex-nowrap items-center gap-2 overflow-x-auto">
      ${actions
        .map((item) => `
          <button
            type="button"
            class="h-10 shrink-0 rounded-md ${item.primary ? 'bg-blue-600 px-4 font-medium text-white hover:bg-blue-700' : 'border bg-background px-4 text-slate-700 hover:bg-muted'} text-sm"
            data-nav="${escapeHtml(buildWaitProcessWarehouseActionHref(item.action))}"
          >
            ${escapeHtml(item.label)}
          </button>
        `)
        .join('')}
    </div>
  `
}

function renderWaitProcessActionTextField(field: string, label: string, placeholder: string, value = ''): string {
  return `
    <label class="block">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <input
        data-wait-process-field="${escapeHtml(field)}"
        value="${escapeHtml(value)}"
        class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500"
        placeholder="${escapeHtml(placeholder)}"
      />
    </label>
  `
}

function renderWaitProcessActionSelect(field: string, label: string, options: Array<{ value: string; label: string }>): string {
  return `
    <label class="block">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <select data-wait-process-field="${escapeHtml(field)}" class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500">
        ${options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </label>
  `
}

function renderWaitProcessWarehouseActionDialog(items: WaitProcessInventoryItem[]): string {
  const action = getWarehouseSearchParams().get('warehouseAction') as WaitProcessWarehouseAction | null
  if (!action || !['claim', 'process-issue', 'return'].includes(action)) return ''

  const closeHref = escapeHtml(buildWaitProcessWarehouseActionHref(undefined))
  const areaOptions = Array.from(new Set(items.map((item) => item.locationLabel.split(' / ')[0]).filter(Boolean)))
  const locationOptions = Array.from(new Set(items.map((item) => item.locationLabel.split(' / ')[1]).filter(Boolean)))
  const materialOptions = items.slice(0, 24).map((item) => ({
    value: item.row.cutOrderId,
    label: `${item.row.cutOrderNo} / ${item.row.materialIdentity.materialSku} / ${item.row.materialIdentity.materialColor}`,
  }))
  const baseAreaOptions = (areaOptions.length ? areaOptions : ['面料 A 区', '面料 B 区']).map((value) => ({ value, label: value }))
  const baseLocationOptions = (locationOptions.length ? locationOptions : ['FAB-A-01', 'FAB-B-02']).map((value) => ({ value, label: value }))
  const baseMaterialOptions = materialOptions.length ? materialOptions : [{ value: '', label: '扫描后带出面料' }]

  const config: Record<WaitProcessWarehouseAction, { title: string; badge: string; submitLabel: string; fields: string[]; eventText: string }> = {
    claim: {
      title: '中转仓领料',
      badge: '形成中转仓领料记录',
      submitLabel: '确认领料',
      eventText: '确认后形成中转仓领料记录，并直接写入裁床待加工仓库区库位。',
      fields: [
        renderWaitProcessActionTextField('scanCode', '扫描中转仓配料单 / 裁片单', '扫中转仓配料单或裁片单二维码'),
        renderWaitProcessActionSelect('cutOrderId', '面料', baseMaterialOptions),
        renderWaitProcessActionTextField('quantity', '领料数量', '例如 300'),
        renderWaitProcessActionTextField('rollCount', '卷数', '例如 2'),
        renderWaitProcessActionSelect('warehouseArea', '入库库区', baseAreaOptions),
        renderWaitProcessActionSelect('locationCode', '入库库位', baseLocationOptions),
        renderWaitProcessActionTextField('operatorName', '领料人', '默认当前操作人'),
      ],
    },
    'process-issue': {
      title: '加工领料',
      badge: '形成加工领料记录',
      submitLabel: '确认领料',
      eventText: '确认后从来源库区库位扣减库存，并记录用于哪张铺布单或加工任务。',
      fields: [
        renderWaitProcessActionTextField('scanCode', '扫描铺布单 / 裁片单', '扫铺布单、唛架编号或裁片单二维码'),
        renderWaitProcessActionSelect('cutOrderId', '面料', baseMaterialOptions),
        renderWaitProcessActionSelect('warehouseArea', '来源库区', baseAreaOptions),
        renderWaitProcessActionSelect('locationCode', '来源库位', baseLocationOptions),
        renderWaitProcessActionTextField('quantity', '领用数量', '例如 120'),
        renderWaitProcessActionTextField('rollCount', '卷数', '例如 1'),
        renderWaitProcessActionTextField('spreadingOrderNo', '加工用途', '例如 铺布单 PB-2441'),
      ],
    },
    return: {
      title: '回收入仓',
      badge: '形成回收入仓记录',
      submitLabel: '确认回收入仓',
      eventText: '确认后把铺布未用完的面料回收到指定库区库位，恢复待加工仓库存。',
      fields: [
        renderWaitProcessActionTextField('scanCode', '扫描铺布单 / 布卷', '扫铺布单或布卷码'),
        renderWaitProcessActionSelect('cutOrderId', '面料', baseMaterialOptions),
        renderWaitProcessActionTextField('quantity', '回收数量', '例如 35'),
        renderWaitProcessActionTextField('rollCount', '卷数', '例如 1'),
        renderWaitProcessActionSelect('warehouseArea', '回收库区', baseAreaOptions),
        renderWaitProcessActionSelect('locationCode', '回收库位', baseLocationOptions),
        renderWaitProcessActionTextField('returnReason', '回收原因', '例如 铺布余料', '铺布剩余'),
      ],
    },
  }
  const current = config[action]

  return `
    <div class="fixed inset-0 z-[120]" data-wait-process-modal data-wait-process-action-type="${escapeHtml(action)}">
      <button class="absolute inset-0 bg-black/45" data-nav="${closeHref}" aria-label="关闭弹窗"></button>
      <section class="absolute left-1/2 top-1/2 w-[min(760px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold">${escapeHtml(current.title)}</h2>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(current.eventText)}</div>
          </div>
          <span class="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">${escapeHtml(current.badge)}</span>
        </header>
        <div class="max-h-[68vh] overflow-y-auto p-4">
          <div class="grid gap-3 md:grid-cols-2">${current.fields.join('')}</div>
          <label class="mt-3 block">
            <span class="text-xs font-medium text-slate-700">备注</span>
            <textarea data-wait-process-field="remark" class="mt-1 h-20 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="现场说明，可不填"></textarea>
          </label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-nav="${closeHref}">取消</button>
          <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-wait-process-action="submit">${escapeHtml(current.submitLabel)}</button>
        </footer>
      </section>
    </div>
  `
}

function removeWaitProcessWarehouseActionDialog(): void {
  if (typeof document === 'undefined') return
  document.querySelector<HTMLElement>('[data-wait-process-modal]')?.remove()
}

function requestWaitProcessRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('higood:request-render'))
}

function readWaitProcessActionField(dialog: ParentNode, field: string): string {
  return dialog.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-wait-process-field="${field}"]`)?.value.trim() || ''
}

function readWaitProcessActionNumber(dialog: ParentNode, field: string): number {
  const value = Number(readWaitProcessActionField(dialog, field))
  return Number.isFinite(value) ? value : 0
}

function compactRuntimeActionDate(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 14) || String(Date.now())
}

function nowRuntimeActionTime(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function findWaitProcessActionItem(cutOrderId: string): WaitProcessInventoryItem | undefined {
  return buildWaitProcessInventoryItems(buildWaitProcessMaterialLedgerSummary().rows)
    .find((item) => item.row.cutOrderId === cutOrderId)
}

function buildRuntimeMaterialFromWaitProcessRow(row: MaterialLedgerProjection) {
  const unit = row.unit === '片' || row.unit === '件' ? row.unit : '米'
  return {
    materialSku: row.materialIdentity.materialSku,
    materialName: row.materialIdentity.materialName,
    materialColor: row.materialIdentity.materialColor,
    materialAlias: row.materialIdentity.materialAlias,
    unit,
  }
}

function buildRuntimePatternFromWaitProcessRow(row: MaterialLedgerProjection) {
  return {
    patternFileId: row.patternIdentity.patternFileId,
    patternFileName: row.patternIdentity.patternFileName,
    patternVersion: row.patternIdentity.patternVersion,
    effectiveWidth: `${row.patternIdentity.effectiveWidthValue || ''}${row.patternIdentity.effectiveWidthUnit || ''}` || '待补',
    partNames: row.patternIdentity.piecePartNames || [],
  }
}

function submitWaitProcessWarehouseAction(dialog: HTMLElement): boolean {
  const action = dialog.dataset.waitProcessActionType as WaitProcessWarehouseAction | undefined
  if (!action) return false
  const selectedItem = findWaitProcessActionItem(readWaitProcessActionField(dialog, 'cutOrderId'))
  if (!selectedItem) {
    window.alert('请选择本次操作的面料。')
    return true
  }
  const row = selectedItem.row
  const quantity = readWaitProcessActionNumber(dialog, 'quantity')
  if (quantity <= 0) {
    window.alert('请输入大于 0 的数量。')
    return true
  }
  const rollCount = Math.max(1, Math.round(readWaitProcessActionNumber(dialog, 'rollCount') || estimateMaterialRollCount(quantity)))
  const operatorName = readWaitProcessActionField(dialog, 'operatorName') || '裁床仓管'
  const occurredAt = nowRuntimeActionTime()
  const compactDate = compactRuntimeActionDate(occurredAt)
  const commonInput = {
    eventSource: 'WEB' as const,
    eventStatus: '已同步' as const,
    operatorName,
    operatorRole: '裁床仓管',
    occurredAt,
    refs: {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
    },
    material: buildRuntimeMaterialFromWaitProcessRow(row),
    pattern: buildRuntimePatternFromWaitProcessRow(row),
  }
  const warehouseArea = readWaitProcessActionField(dialog, 'warehouseArea')
  const locationCode = readWaitProcessActionField(dialog, 'locationCode')

  if (!warehouseArea || !locationCode) {
    window.alert('请确认库区和库位。')
    return true
  }

  if (action === 'claim') {
    const payload: TransferPickupPayload = {
      pickupRecordId: `web-pickup:${row.cutOrderId}:${compactDate}`,
      pickupRecordNo: `裁床领料-${compactDate.slice(-6)}`,
      prepNoticeId: readWaitProcessActionField(dialog, 'scanCode') || `prep:${row.cutOrderId}`,
      prepOrderNo: readWaitProcessActionField(dialog, 'scanCode') || row.cutOrderNo,
      pickupQty: quantity,
      unit: '米',
      rollCount,
      rollNos: [],
      warehouseArea,
      locationCode,
      pickupBy: operatorName,
      pickupAt: occurredAt,
      hasDifference: false,
      differenceReason: readWaitProcessActionField(dialog, 'remark') || undefined,
    }
    appendCuttingRuntimeEvent({
      ...commonInput,
      eventType: '中转仓领料',
      inventoryEffect: {
        inventoryScope: '裁床待加工仓',
        direction: 'IN',
        qty: quantity,
        unit: '米',
        rollCount,
        toWarehouseArea: warehouseArea,
        toLocationCode: locationCode,
      },
      payload,
    })
    return false
  }

  if (action === 'process-issue') {
    const spreadingOrderNo = readWaitProcessActionField(dialog, 'spreadingOrderNo') || readWaitProcessActionField(dialog, 'scanCode') || '铺布单待补'
    const payload: WaitProcessIssuePayload = {
      issueRecordId: `web-issue:${row.cutOrderId}:${compactDate}`,
      issueRecordNo: `加工领料-${compactDate.slice(-6)}`,
      spreadingOrderId: spreadingOrderNo,
      spreadingOrderNo,
      materialSku: row.materialIdentity.materialSku,
      issuedQty: quantity,
      unit: '米',
      rollCount,
      rollNos: [],
      fromWarehouseArea: warehouseArea,
      fromLocationCode: locationCode,
      issuedBy: operatorName,
      issuedAt: occurredAt,
      purpose: '铺布用料',
    }
    appendCuttingRuntimeEvent({
      ...commonInput,
      eventType: '待加工仓加工领料',
      refs: { ...commonInput.refs, spreadingOrderNo },
      inventoryEffect: {
        inventoryScope: '裁床待加工仓',
        direction: 'OUT',
        qty: quantity,
        unit: '米',
        rollCount,
        fromWarehouseArea: warehouseArea,
        fromLocationCode: locationCode,
      },
      payload,
    })
    return false
  }

  const spreadingOrderNo = readWaitProcessActionField(dialog, 'scanCode') || '铺布单待补'
  const payload: WaitProcessReturnPayload = {
    returnRecordId: `web-return:${row.cutOrderId}:${compactDate}`,
    returnRecordNo: `回收入仓-${compactDate.slice(-6)}`,
    spreadingOrderId: spreadingOrderNo,
    spreadingOrderNo,
    materialSku: row.materialIdentity.materialSku,
    returnedQty: quantity,
    unit: '米',
    rollCount,
    rollNos: [],
    warehouseArea,
    locationCode,
    returnedBy: operatorName,
    returnedAt: occurredAt,
    reason: readWaitProcessActionField(dialog, 'returnReason') === '取消加工' ? '取消加工' : readWaitProcessActionField(dialog, 'returnReason') === '其他' ? '其他' : '铺布剩余',
  }
  appendCuttingRuntimeEvent({
    ...commonInput,
    eventType: '待加工仓回收入仓',
    refs: { ...commonInput.refs, spreadingOrderNo },
    inventoryEffect: {
      inventoryScope: '裁床待加工仓',
      direction: 'IN',
      qty: quantity,
      unit: '米',
      rollCount,
      toWarehouseArea: warehouseArea,
      toLocationCode: locationCode,
    },
    payload,
  })
  return false
}

export function handleCraftCuttingWaitProcessEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-wait-process-action]')
  const action = actionNode?.dataset.waitProcessAction
  if (!action) return false
  const dialog = actionNode.closest<HTMLElement>('[data-wait-process-modal]')
  if (action === 'close-dialog') {
    removeWaitProcessWarehouseActionDialog()
    return true
  }
  if (action !== 'submit' || !dialog) return false
  const blocked = submitWaitProcessWarehouseAction(dialog)
  if (blocked) return true
  removeWaitProcessWarehouseActionDialog()
  requestWaitProcessRefresh()
  return true
}

function filterWaitProcessEvents(
  rows: MaterialLedgerProjection[],
  eventTypes: CuttingMaterialLedgerEventType[],
  filters: WaitProcessFilterState,
): CuttingMaterialLedgerEvent[] {
  const eventTypeByLabel = new Map<CuttingMaterialLedgerEventType | string, CuttingMaterialLedgerEventType>()
  eventTypes.forEach((eventType) => {
    eventTypeByLabel.set(eventType, eventType)
    eventTypeByLabel.set(cuttingMaterialLedgerEventTypeLabels[eventType], eventType)
    eventTypeByLabel.set(getWaitProcessEventTypeLabel(eventType), eventType)
  })
  const selectedEventType = filters.eventType === '全部' ? '' : eventTypeByLabel.get(filters.eventType)
  return rows
    .flatMap((row) => row.events)
    .filter((event) => eventTypes.includes(event.eventType))
    .filter((event) => {
      const keywordMatched = includesKeyword(
        [
          event.cutOrderNo,
          event.productionOrderNo,
          event.materialSku,
          event.materialName,
          event.materialColor,
          event.materialAlias,
          event.sourceObjectId,
          event.remark,
        ],
        filters.keyword,
      )
      const operatorMatched = !filters.operatorName || filters.operatorName === '全部' || event.operatorName === filters.operatorName
      const typeMatched = !selectedEventType || event.eventType === selectedEventType
      const eventDate = getEventDateValue(event.occurredAt)
      const fromMatched = !filters.dateFrom || eventDate >= filters.dateFrom
      const toMatched = !filters.dateTo || eventDate <= filters.dateTo
      return keywordMatched && operatorMatched && typeMatched && fromMatched && toMatched
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
}

function renderWaitProcessEventTable(
  events: CuttingMaterialLedgerEvent[],
  emptyText: string,
  inventoryItems: WaitProcessInventoryItem[],
  options: {
    eventTypeLabel?: (event: CuttingMaterialLedgerEvent) => string
    sourceLabel?: (event: CuttingMaterialLedgerEvent) => string
    statusLabel?: (event: CuttingMaterialLedgerEvent) => string
  } = {},
): string {
  if (!events.length) return `<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  const locationByCutOrderId = buildWaitProcessInventoryLocationMap(inventoryItems)

  return `
    <div class="rounded-lg border bg-card">
      <div class="max-h-[28rem] overflow-y-auto">
        <table class="w-full table-fixed text-left text-sm">
          <colgroup>
            <col class="w-[16%]" />
            <col class="w-[18%]" />
            <col class="w-[14%]" />
            <col class="w-[16%]" />
            <col class="w-[14%]" />
            <col class="w-[14%]" />
            <col class="w-[8%]" />
          </colgroup>
          <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">裁片单</th>
              <th class="px-3 py-2 font-medium">面料</th>
              <th class="px-3 py-2 font-medium">数量</th>
              <th class="px-3 py-2 font-medium">流水类型 / 来源</th>
              <th class="px-3 py-2 font-medium">库区 / 库位</th>
              <th class="px-3 py-2 font-medium">操作人</th>
              <th class="px-3 py-2 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            ${events.map((event) => `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-3 align-top">
                  <div class="truncate font-medium text-blue-700" title="${escapeHtml(event.cutOrderNo)}">${escapeHtml(event.cutOrderNo)}</div>
                  <div class="mt-1 truncate text-xs text-muted-foreground" title="${escapeHtml(event.productionOrderNo)}">${escapeHtml(event.productionOrderNo)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="truncate font-medium" title="${escapeHtml(event.materialSku)}">${escapeHtml(event.materialSku)}</div>
                  <div class="mt-1 truncate text-xs text-muted-foreground" title="${escapeHtml(event.materialColor)}">颜色：${escapeHtml(event.materialColor || '待补')}</div>
                </td>
                <td class="px-3 py-3 align-top font-medium tabular-nums">${escapeHtml(formatMaterialQtyWithRolls(event.quantity, event.unit))}</td>
                <td class="px-3 py-3 align-top text-xs">
                  <div class="truncate font-medium" title="${escapeHtml(options.eventTypeLabel?.(event) || getWaitProcessEventTypeLabel(event.eventType))}">${escapeHtml(options.eventTypeLabel?.(event) || getWaitProcessEventTypeLabel(event.eventType))}</div>
                  <div class="mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium text-slate-700">${escapeHtml(options.statusLabel?.(event) || getWaitProcessStockDirectionLabel(event.eventType))}</div>
                  <div class="mt-1 truncate text-muted-foreground" title="${escapeHtml(options.sourceLabel?.(event) || getWaitProcessEventSourceLabel(event))}">${escapeHtml(options.sourceLabel?.(event) || getWaitProcessEventSourceLabel(event))}</div>
                  <div class="mt-1 truncate text-muted-foreground" title="${escapeHtml(getWaitProcessEventSourceDetail(event))}">${escapeHtml(getWaitProcessEventSourceDetail(event))}</div>
                  <div class="mt-1 truncate text-muted-foreground" title="${escapeHtml(event.remark)}">${escapeHtml(event.remark)}</div>
                </td>
                <td class="px-3 py-3 align-top text-xs">
                  <div class="truncate font-medium" title="${escapeHtml(getWaitProcessEventLocationLabel(event, locationByCutOrderId))}">${escapeHtml(getWaitProcessEventLocationLabel(event, locationByCutOrderId))}</div>
                </td>
                <td class="px-3 py-3 align-top">${escapeHtml(event.operatorName)}</td>
                <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(event.occurredAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderHubActionCard(options: {
  title: string
  rows: Array<[string, string | number]>
}): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold">${escapeHtml(options.title)}</h2>
        </div>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${options.rows
          .map(
            ([label, value]) => `
              <div class="rounded-md border bg-background px-3 py-2">
                <dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt>
                <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(String(value))}</dd>
              </div>
            `,
          )
          .join('')}
      </dl>
    </article>
  `
}

function renderHubGuideCard(title: string, lines: string[]): string {
  return `
    <article class="rounded-lg border border-dashed bg-muted/20 p-4 xl:col-span-2">
      <h2 class="text-base font-semibold">${escapeHtml(title)}</h2>
      <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
        ${lines
          .map(
            (line) => `
              <li class="flex gap-2">
                <span class="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                <span>${escapeHtml(line)}</span>
              </li>
            `,
          )
          .join('')}
      </ul>
    </article>
  `
}

function renderHubTable(headers: string[], rows: string[][], emptyText = '暂无数据'): string {
  if (!rows.length) {
    return `<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }
  const tableHtml = `
    <table class="min-w-[960px] w-full text-left text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
        <tr>
          ${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `
            <tr class="border-b last:border-b-0">
              ${row.map((cell) => `<td class="px-3 py-3 align-top">${escapeHtml(cell)}</td>`).join('')}
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `
  return `
    <div class="rounded-lg border bg-card">
      ${renderStickyTableScroller(tableHtml, 'max-h-[28rem]')}
    </div>
  `
}

function renderWaitHandoverPill(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function getWaitHandoverInboundBagStatusClass(status: string): string {
  if (status.includes('暂存') || status.includes('入仓')) return 'bg-cyan-100 text-cyan-700 border border-cyan-200'
  if (status.includes('装袋')) return 'bg-blue-100 text-blue-700 border border-blue-200'
  if (status.includes('交出')) return 'bg-orange-100 text-orange-700 border border-orange-200'
  return 'bg-slate-100 text-slate-700 border border-slate-200'
}

function renderWaitHandoverTransferBagQrCell(bagCode: string): string {
  const normalizedBagCode = bagCode.trim()
  if (!normalizedBagCode) return '<div class="text-xs text-muted-foreground">暂无二维码</div>'
  return `
    <div class="inline-flex flex-col items-center gap-1">
      ${renderRealQrPlaceholder({
        value: `TRANSFER_BAG:${normalizedBagCode}`,
        size: 56,
        title: `中转袋二维码 ${normalizedBagCode}`,
        label: `中转袋 ${normalizedBagCode} 二维码`,
        className: 'rounded-md border bg-white p-1 shadow-sm',
      })}
      <div class="text-[11px] text-muted-foreground">已生成</div>
    </div>
  `
}

function filterWaitHandoverInboundTempBags(
  bags: InboundTempBag[],
  filters: Pick<WaitHandoverFilterState, 'keyword' | 'locationArea'>,
): InboundTempBag[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return bags.filter((bag) => {
    const keywordMatched = !keyword || [
      bag.tempBagUseId,
      bag.bagCode,
      bag.warehouseName,
      bag.warehouseArea,
      bag.locationCode,
      bag.inboundStatus,
      bag.inboundBy,
      bag.mixedSummary,
      bag.nextSortingStatus,
      ...bag.containedFeiTickets.flatMap((ticket) => [
        ticket.feiTicketNo,
        ticket.productionOrderNo,
        ticket.cutOrderNo,
        ticket.spuCode,
        ticket.color,
        ticket.size,
        ticket.partName,
        ticket.specialCraftDisplay,
        ticket.receiverFactoryDisplay,
      ]),
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
    const locationMatched = filters.locationArea === '全部' || bag.warehouseArea === filters.locationArea
    return keywordMatched && locationMatched
  })
}

function renderWaitHandoverInboundTempUseTable(bags: InboundTempBag[], emptyText = '暂无入仓暂存装袋记录。'): string {
  if (!bags.length) {
    return `<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }
  return `
    <section class="rounded-lg border bg-card">
      ${renderStickyTableScroller(`
        <table class="min-w-[1200px] w-full text-sm">
          <thead class="sticky top-0 z-10 bg-muted/95 text-xs text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">中转袋</th>
              <th class="px-4 py-3 text-left font-medium">中转袋二维码</th>
              <th class="px-4 py-3 text-left font-medium">入仓信息</th>
              <th class="px-4 py-3 text-left font-medium">装入内容</th>
              <th class="px-4 py-3 text-left font-medium">混装情况</th>
              <th class="px-4 py-3 text-left font-medium">后续状态</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${bags.map((bag) => {
              const productionOrderCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.productionOrderNo)).length
              const cutOrderCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.cutOrderNo)).length
              const statusText = bag.inboundStatus || '入仓暂存中'
              return `
                <tr class="border-b last:border-b-0">
                  <td class="px-4 py-3 align-top">
                    <div class="font-medium text-blue-700">${escapeHtml(bag.bagCode)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(bag.tempBagUseId)}</div>
                    <div class="mt-2">${renderWaitHandoverPill(statusText, getWaitHandoverInboundBagStatusClass(statusText))}</div>
                  </td>
                  <td class="px-4 py-3 align-top">${renderWaitHandoverTransferBagQrCell(bag.bagCode)}</td>
                  <td class="px-4 py-3 align-top text-xs text-muted-foreground">
                    <div><span class="font-medium text-foreground">${escapeHtml(bag.inboundAt || '待入仓')}</span></div>
                    <div class="mt-1">入仓人：${escapeHtml(bag.inboundBy || '裁床仓管')}</div>
                    <div class="mt-1">${escapeHtml(`${bag.warehouseName || '裁床待交出仓'} / ${bag.warehouseArea || '待确认库区'} / ${bag.locationCode || '待确认库位'}`)}</div>
                  </td>
                  <td class="px-4 py-3 align-top text-xs text-muted-foreground">
                    <div><span class="font-medium text-foreground">${escapeHtml(String(bag.containedFeiTickets.length))}</span> 张菲票</div>
                    <div class="mt-1"><span class="font-medium text-foreground">${escapeHtml(formatPieceQty(bag.totalPieceQty))}</span></div>
                    <div class="mt-1">${escapeHtml(`${productionOrderCount} 个生产单 / ${cutOrderCount} 张裁片单`)}</div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    ${renderWaitHandoverPill(bag.mixedFlag ? '混装' : '单一来源', bag.mixedFlag ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200')}
                    <div class="mt-2 max-w-[220px] text-xs text-muted-foreground">${escapeHtml(bag.mixedSummary || '按袋内菲票明细追踪')}</div>
                  </td>
                  <td class="px-4 py-3 align-top text-xs text-muted-foreground">${escapeHtml(bag.nextSortingStatus || '暂存中，等待二次分拣或转出')}</td>
                  <td class="px-4 py-3 align-top">
                    <div class="flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', 'inventory'))}">查看菲票</button>
                      <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', 'inventory'))}">查看库存流水</button>
                      <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="open-inbound" data-wait-handover-selection="${escapeHtml(bag.bagCode)}">继续装袋</button>
                    </div>
                  </td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      `)}
    </section>
  `
}

interface WaitHandoverBaggingTableRow {
  pickingTaskNo: string
  sewingTaskNo: string
  sourceTempBags: string
  baggingRecordSummary: string
  targetTransferBags: string
  packedTicketText: string
  receiverName: string
  shortageText: string
  status: string
  confirmSelection: string
}

function renderWaitHandoverBaggingTable(rows: WaitHandoverBaggingTableRow[], emptyText = '暂无交出装袋确认任务。'): string {
  if (!rows.length) {
    return `<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }
  const tableHtml = `
    <table class="min-w-[1120px] w-full text-left text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
        <tr>
          ${['交出装袋确认任务', '车缝任务', '来源暂存袋', '交出装袋确认记录', '目标中转袋', '已装袋菲票', '接收对象', '装袋后缺口', '状态', '操作']
            .map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`)
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr class="border-b last:border-b-0">
            <td class="px-3 py-3 align-top font-medium text-blue-700">${escapeHtml(row.pickingTaskNo)}</td>
            <td class="px-3 py-3 align-top">${escapeHtml(row.sewingTaskNo)}</td>
            <td class="px-3 py-3 align-top">${escapeHtml(row.sourceTempBags)}</td>
            <td class="px-3 py-3 align-top">${escapeHtml(row.baggingRecordSummary)}</td>
            <td class="px-3 py-3 align-top">${escapeHtml(row.targetTransferBags)}</td>
            <td class="px-3 py-3 align-top">${escapeHtml(row.packedTicketText)}</td>
            <td class="px-3 py-3 align-top">${escapeHtml(row.receiverName)}</td>
            <td class="px-3 py-3 align-top">${escapeHtml(row.shortageText)}</td>
            <td class="px-3 py-3 align-top">${escapeHtml(row.status)}</td>
            <td class="px-3 py-3 align-top">
              <div class="flex flex-wrap gap-2">
                <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="open-handover-bagging-confirm">交出装袋确认</button>
                ${
                  row.confirmSelection
                    ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="open-handover" data-wait-handover-selection="${escapeHtml(row.confirmSelection)}">交出确认</button>`
                    : '<button type="button" class="cursor-not-allowed rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground" disabled>交出确认</button>'
                }
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
  return `
    <div class="rounded-lg border bg-card">
      ${renderStickyTableScroller(tableHtml, 'max-h-[28rem]')}
    </div>
  `
}

function getWaitHandoverEventQty(event: CuttingRuntimeEvent): number {
  const payload = toRuntimeRecord(event.payload)
  if (event.inventoryEffect?.qty) return event.inventoryEffect.qty
  return (
    runtimeNumber(payload.totalPieceQty) ||
    runtimeNumber(payload.currentHandedOverQty) ||
    runtimeNumber(payload.pickedQty) ||
    runtimeNumber(payload.returnedQty) ||
    (Array.isArray(payload.feiTicketItems)
      ? payload.feiTicketItems.reduce((sum, rawItem) => sum + runtimeNumber(toRuntimeRecord(rawItem).pieceQty), 0)
      : 0) ||
    (Array.isArray(payload.returnedFeiTicketItems)
      ? payload.returnedFeiTicketItems.reduce((sum, rawItem) => sum + runtimeNumber(toRuntimeRecord(rawItem).returnedQty), 0)
      : 0)
  )
}

function getWaitHandoverEventBagText(event: CuttingRuntimeEvent): string {
  const payload = toRuntimeRecord(event.payload)
  const transferBagUses = Array.isArray(payload.transferBagUses) ? payload.transferBagUses : []
  const bagCodes = uniqueStrings([
    runtimeString(payload.bagCode),
    runtimeString(payload.sourceTempBagCode),
    runtimeString(payload.targetTransferBagCode),
    event.refs.transferBagCode,
    ...transferBagUses.map((rawBag) => runtimeString(toRuntimeRecord(rawBag).bagCode)),
  ])
  return bagCodes.join('、') || '按菲票追踪'
}

function getWaitHandoverEventTypeLabel(eventType: CuttingRuntimeEvent['eventType']): string {
  if (eventType === '菲票入仓暂存') return '入仓暂存装袋'
  if (eventType === '交出装袋确认') return '交出装袋确认'
  if (eventType === '新增交出记录') return '交出确认'
  if (eventType === '特殊工艺交出') return '特殊工艺交出'
  if (eventType === '特殊工艺回仓') return '特殊工艺回仓'
  return eventType
}

function getWaitHandoverEventSourceText(event: CuttingRuntimeEvent): string {
  const payload = toRuntimeRecord(event.payload)
  if (event.eventType === '菲票入仓暂存') return `入仓暂存装袋：${getWaitHandoverEventBagText(event)}`
  if (event.eventType === '交出装袋确认') return `交出装袋确认：${runtimeString(payload.pickingTaskNo) || runtimeString(payload.targetTransferBagCode) || getWaitHandoverEventBagText(event)}`
  if (event.eventType === '新增交出记录') {
    return `交出确认：${runtimeString(payload.handoverRecordNo) || runtimeString(payload.handoverOrderNo) || runtimeString(payload.receiverName) || getWaitHandoverEventBagText(event)}`
  }
  if (event.eventType === '特殊工艺交出') return `特殊工艺交出：${runtimeString(payload.craftType) || runtimeString(payload.receiverFactoryName) || getWaitHandoverEventBagText(event)}`
  if (event.eventType === '特殊工艺回仓') return `特殊工艺回仓：${runtimeString(payload.returnRecordNo) || runtimeString(payload.receiverFactoryName) || '回仓记录'}`
  return getWaitHandoverEventTypeLabel(event.eventType)
}

function getWaitHandoverEventStatusText(event: CuttingRuntimeEvent): string {
  if (event.eventStatus === '同步失败') return '同步失败'
  if (event.eventType === '菲票入仓暂存') return '已入仓'
  if (event.eventType === '交出装袋确认') return '已装袋待交出'
  if (event.eventType === '新增交出记录') return '已交出待回收'
  if (event.eventType === '特殊工艺交出') return '加工中'
  if (event.eventType === '特殊工艺回仓') return '已回仓'
  return event.eventStatus
}

function getWaitHandoverEventLocationText(event: CuttingRuntimeEvent): string {
  const payload = toRuntimeRecord(event.payload)
  const area =
    runtimeString(payload.warehouseArea) ||
    event.inventoryEffect?.toWarehouseArea ||
    event.inventoryEffect?.fromWarehouseArea ||
    '裁床待交出仓'
  const location =
    runtimeString(payload.locationCode) ||
    event.inventoryEffect?.toLocationCode ||
    event.inventoryEffect?.fromLocationCode ||
    ''
  return [area, location].filter(Boolean).join(' / ')
}

function eventMatchesWaitHandoverRecord(event: CuttingRuntimeEvent, record: InboundTempBagInventoryRecord): boolean {
  const serializedPayload = JSON.stringify(event.payload || {})
  return [
    event.refs.feiTicketIds?.includes(record.feiTicketId),
    event.refs.feiTicketNos?.includes(record.feiTicketNo),
    serializedPayload.includes(record.feiTicketId),
    serializedPayload.includes(record.feiTicketNo),
    record.tempBagCode && serializedPayload.includes(record.tempBagCode),
    record.tempBagCode && event.refs.transferBagCode === record.tempBagCode,
  ].some(Boolean)
}

function buildWaitHandoverFlowLines(
  record: InboundTempBagInventoryRecord,
  events: CuttingRuntimeEvent[],
): FactoryWarehouseFlowLine[] {
  return events
    .filter((event) => eventMatchesWaitHandoverRecord(event, record))
    .map((event) => ({
      flowType: getWaitHandoverEventTypeLabel(event.eventType),
      qtyText: formatPieceQty(getWaitHandoverEventQty(event)),
      sourceNo: getWaitHandoverEventSourceText(event),
      operatedAt: event.occurredAt,
      operatorName: event.operatorName,
      statusText: getWaitHandoverEventStatusText(event),
    }))
}

function buildWaitHandoverReservedQtyMap(projection: HandoverPickingTaskProjection): Map<string, number> {
  const reservedQtyByRecord = new Map<string, number>()
  projection.tasks.forEach((task) => {
    if (task.taskStatus === '已关闭') return
    task.allocatedInventoryItems.forEach((item) => {
      reservedQtyByRecord.set(
        item.inventoryRecordId,
        (reservedQtyByRecord.get(item.inventoryRecordId) || 0) + item.pieceQty,
      )
    })
  })
  return reservedQtyByRecord
}

function normalizeWaitHandoverInventoryStatus(
  record: InboundTempBagInventoryRecord,
  reservedQty: number,
): string {
  if (record.voidStatus === '已作废' || record.inventoryStatus === '已作废或不可用') return '已作废 / 不可用'
  if (record.inventoryStatus === '已交出') return '已交出待回收'
  if (record.inventoryStatus === '已装袋待交出') return '已装袋待交出'
  if (record.inventoryStatus === '已分拣待装袋') return '交出装袋确认中'
  if (record.inventoryStatus === '已分配待分拣' || reservedQty > 0) return '已占用'
  return '在库可分配'
}

function getWaitHandoverSpecialCraftStatus(record: InboundTempBagInventoryRecord): string {
  if (!record.hasSpecialCraft && !record.specialCraftDisplay.includes('回仓')) return '无特殊工艺'
  if (record.specialCraftDisplay.includes('已回仓')) return '特殊工艺已回仓'
  if (record.specialCraftDisplay.includes('加工中')) return '特殊工艺加工中'
  return record.hasSpecialCraft ? '待特殊工艺交出' : record.specialCraftDisplay || '无特殊工艺'
}

function filterWaitHandoverInventoryRecords(
  records: InboundTempBagInventoryRecord[],
  filters: WaitHandoverFilterState,
  reservedQtyByRecord: Map<string, number>,
): InboundTempBagInventoryRecord[] {
  return records.filter((record) => {
    const reservedQty = reservedQtyByRecord.get(record.inventoryRecordId) || 0
    const status = normalizeWaitHandoverInventoryStatus(record, reservedQty)
    const specialCraftStatus = getWaitHandoverSpecialCraftStatus(record)
    const keywordMatched = includesKeyword([
      record.feiTicketNo,
      record.productionOrderNo,
      record.cutOrderNo,
      record.spuCode,
      record.color,
      record.size,
      record.partName,
      record.tempBagCode,
      record.warehouseArea,
      record.locationCode,
      record.specialCraftDisplay,
      record.receiverFactoryDisplay,
    ], filters.keyword)
    const statusMatched = filters.stockStatus === '全部' || status === filters.stockStatus
    const locationMatched = filters.locationArea === '全部' || record.warehouseArea === filters.locationArea
    const specialCraftMatched = filters.specialCraftStatus === '全部' || specialCraftStatus === filters.specialCraftStatus
    const receiverMatched = !filters.receiverName || record.receiverFactoryDisplay.includes(filters.receiverName)
    return keywordMatched && statusMatched && locationMatched && specialCraftMatched && receiverMatched
  })
}

function filterWaitHandoverEvents(events: CuttingRuntimeEvent[], filters: WaitHandoverFilterState): CuttingRuntimeEvent[] {
  return events.filter((event) => {
    const payloadText = JSON.stringify(event.payload || {})
    const keywordMatched = includesKeyword([
      event.eventType,
      event.refs.productionOrderNo,
      event.refs.cutOrderNo,
      event.refs.transferBagCode,
      ...(event.refs.feiTicketNos || []),
      payloadText,
    ], filters.keyword)
    const typeMatched =
      filters.eventType === '全部' ||
      event.eventType === filters.eventType ||
      getWaitHandoverEventTypeLabel(event.eventType) === filters.eventType
    const eventDate = event.occurredAt.slice(0, 10)
    const fromMatched = !filters.dateFrom || eventDate >= filters.dateFrom
    const toMatched = !filters.dateTo || eventDate <= filters.dateTo
    return keywordMatched && typeMatched && fromMatched && toMatched
  })
}

function renderWaitHandoverFilterInput(label: string, name: string, value: string, placeholder: string, widthClass = 'w-72'): string {
  return `
    <label class="block shrink-0 ${widthClass}">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500" />
    </label>
  `
}

function renderWaitHandoverFilterSelect(label: string, name: string, value: string, options: string[], widthClass = 'w-44'): string {
  return `
    <label class="block shrink-0 ${widthClass}">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}" class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500">
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>
    </label>
  `
}

function renderWaitHandoverFilterDate(label: string, name: string, value: string): string {
  return `
    <label class="block w-40 shrink-0">
      <span class="text-xs font-medium text-slate-700">${escapeHtml(label)}</span>
      <input type="date" name="${escapeHtml(name)}" value="${escapeHtml(value)}" class="mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-blue-500" />
    </label>
  `
}

function renderWaitHandoverFilterPanel(options: {
  tabKey: WaitHandoverTabKey
  filters: WaitHandoverFilterState
  inventoryRecords: InboundTempBagInventoryRecord[]
  runtimeEvents: CuttingRuntimeEvent[]
  reservedQtyByRecord: Map<string, number>
}): string {
  const resetHref = buildHubTabHref('warehouse-management-wait-handover', options.tabKey)
  const locationOptions = ['全部', ...uniqueStrings(options.inventoryRecords.map((item) => item.warehouseArea))]
  const eventTypeOptions = ['全部', ...uniqueStrings(options.runtimeEvents.map((item) => getWaitHandoverEventTypeLabel(item.eventType)))]
  const stockStatusOptions = [
    '全部',
    '在库可分配',
    '已占用',
    '交出装袋确认中',
    '已装袋待交出',
    '已交出待回收',
    '已作废 / 不可用',
  ]
  const specialCraftOptions = ['全部', '无特殊工艺', '待特殊工艺交出', '特殊工艺加工中', '特殊工艺已回仓']
  const controls =
    options.tabKey === 'inventory'
      ? [
          renderWaitHandoverFilterInput('菲票 / 生产单 / 袋码', 'q', options.filters.keyword, '菲票号、生产单、裁片单、中转袋'),
          renderWaitHandoverFilterSelect('库存状态', 'stockStatus', options.filters.stockStatus, stockStatusOptions),
          renderWaitHandoverFilterSelect('库区', 'locationArea', options.filters.locationArea, locationOptions),
          renderWaitHandoverFilterSelect('特殊工艺', 'specialCraftStatus', options.filters.specialCraftStatus, specialCraftOptions),
          renderWaitHandoverFilterInput('接收对象', 'receiverName', options.filters.receiverName, '车缝厂 / 特殊工艺厂', 'w-52'),
        ]
      : options.tabKey === 'inbound-bagging' || options.tabKey === 'handover-bagging'
        ? [
            renderWaitHandoverFilterInput('菲票 / 任务 / 袋码', 'q', options.filters.keyword, '菲票号、交出任务、中转袋'),
          ]
        : [
            renderWaitHandoverFilterInput('菲票 / 记录 / 袋码', 'q', options.filters.keyword, '菲票号、交出记录、中转袋'),
            renderWaitHandoverFilterSelect('流水类型', 'eventType', options.filters.eventType, eventTypeOptions),
            renderWaitHandoverFilterDate('开始日期', 'dateFrom', options.filters.dateFrom),
            renderWaitHandoverFilterDate('结束日期', 'dateTo', options.filters.dateTo),
          ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <form method="get" action="${escapeHtml(getCanonicalCuttingPath('warehouse-management-wait-handover'))}" class="flex flex-nowrap items-end gap-3 overflow-x-auto pb-1">
        <input type="hidden" name="tab" value="${escapeHtml(options.tabKey)}" />
        ${controls.join('')}
        <button type="submit" class="h-10 shrink-0 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">筛选</button>
        <button type="button" data-nav="${escapeHtml(resetHref)}" class="h-10 shrink-0 rounded-md border px-4 text-sm hover:bg-muted">重置</button>
      </form>
    </section>
  `
}

function renderWaitHandoverTabs(activeTab: WaitHandoverTabKey): string {
  const tabs: Array<{ key: WaitHandoverTabKey; label: string }> = [
    { key: 'inventory', label: '库存明细' },
    { key: 'inbound-bagging', label: '入仓暂存装袋' },
    { key: 'handover-bagging', label: '交出装袋确认' },
    { key: 'special-craft-return', label: '特殊工艺回仓' },
    { key: 'locations', label: '库区库位' },
  ]
  return renderHubTabs('warehouse-management-wait-handover', activeTab, tabs)
}

function renderWaitHandoverHeaderActions(firstTaskId: string): string {
  return `
    <div class="flex flex-nowrap items-center gap-2 overflow-x-auto">
      <button type="button" class="h-10 shrink-0 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-wait-handover-action="open-inbound">入仓暂存装袋</button>
      <button type="button" class="h-10 shrink-0 rounded-md border bg-background px-4 text-sm text-slate-700 hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="open-handover-bagging-confirm">交出装袋确认</button>
      <button type="button" class="h-10 shrink-0 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm text-blue-700 hover:bg-blue-100" data-nav="/fcs/pda/cutting/inbound/${escapeHtml(firstTaskId)}">PDA 现场扫码</button>
    </div>
  `
}

type WaitHandoverWebAction = 'inbound' | 'handover-bagging-confirm' | 'handover'

const WAIT_HANDOVER_WEB_MODAL_ID = 'cutting-wait-handover-web-action-modal'

function removeWaitHandoverWebActionDialog(): void {
  if (typeof document === 'undefined') return
  document.getElementById(WAIT_HANDOVER_WEB_MODAL_ID)?.remove()
}

function requestWaitHandoverWebRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('higood:request-render'))
}

function getWaitHandoverWebOperator(dialog: ParentNode): { operatorName: string; operatorRole: string } {
  const operatorName = dialog.querySelector<HTMLInputElement>('[data-wait-handover-field="operatorName"]')?.value.trim() || '裁片仓操作员'
  return { operatorName, operatorRole: '裁片仓操作员' }
}

function readWaitHandoverWebField(dialog: ParentNode, field: string): string {
  return dialog.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-wait-handover-field="${field}"]`)?.value.trim() || ''
}

function buildWaitHandoverWebInventoryRecords(): InboundTempBagInventoryRecord[] {
  const generatedTickets = listSpreadingResultGeneratedFeiTickets()
  const runtimeEvents = listRuntimeWaitHandoverEvents()
  const runtimeInboundTempBags = buildRuntimeInboundTempBagsFromEvents(runtimeEvents, generatedTickets)
  const fallbackInboundTempBags = buildInboundTempBagsFromTransferBagViewModel(buildTransferBagsProjection().viewModel)
  const inboundTempBags = runtimeInboundTempBags.length ? runtimeInboundTempBags : fallbackInboundTempBags
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
  const specialCraftReturnRecords = buildRuntimeSpecialCraftReturnInventoryRecordsFromEvents(runtimeEvents, generatedTickets)
  return [...inboundInventoryRecords, ...specialCraftReturnRecords]
}

function buildWaitHandoverWebPickingProjection(): HandoverPickingTaskProjection {
  return buildHandoverPickingTaskProjectionFromAllocationProjection(
    buildSewingTaskAllocationProjectionFromInventory(buildWaitHandoverWebInventoryRecords()),
  )
}

function buildWaitHandoverActionSelectOptions(
  options: Array<{ value: string; label: string; disabled?: boolean }>,
  emptyLabel: string,
  selectedValue = '',
): string {
  if (!options.length) return `<option value="" disabled selected>${escapeHtml(emptyLabel)}</option>`
  return options.map((option, index) => `
    <option value="${escapeHtml(option.value)}" ${option.value === selectedValue || (!selectedValue && index === 0) ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}>${escapeHtml(option.label)}</option>
  `).join('')
}

function getWaitHandoverTicketOptions(): Array<{ value: string; label: string }> {
  const inventoryTicketIds = new Set(buildWaitHandoverWebInventoryRecords().map((record) => record.feiTicketId))
  return buildRuntimeTicketCandidatesFromGeneratedTickets(listSpreadingResultGeneratedFeiTickets())
    .filter((ticket) => ticket.ticketStatus !== 'VOIDED')
    .filter((ticket) => !inventoryTicketIds.has(ticket.feiTicketId))
    .slice(0, 30)
    .map((ticket) => ({
      value: ticket.feiTicketId,
      label: `${ticket.ticketNo} / ${ticket.productionOrderNo} / ${ticket.color} / ${ticket.size} / ${ticket.partName} / ${ticket.actualCutPieceQty || ticket.qty} 片`,
    }))
}

function splitWaitHandoverScanCodes(value: string): string[] {
  return Array.from(new Set(value.split(/[\s,，、;；\n\r]+/).map((item) => item.trim()).filter(Boolean)))
}

function generatedTicketMatchesScanCode(ticket: GeneratedFeiTicketSourceRecord, scanCode: string): boolean {
  const record = ticket as unknown as Record<string, unknown>
  return ['feiTicketId', 'feiTicketNo', 'ticketNo', 'qrValue', 'qrSerializedValue'].some((key) => String(record[key] || '') === scanCode)
}

function resolveWaitHandoverInboundTickets(selectedFeiTicketId: string, scanInput: string): {
  tickets: GeneratedFeiTicketSourceRecord[]
  missingScanCodes: string[]
} {
  const generatedTickets = listSpreadingResultGeneratedFeiTickets()
  const selectedTicket = generatedTickets.find((item) => item.feiTicketId === selectedFeiTicketId)
  const scanCodes = splitWaitHandoverScanCodes(scanInput)
  if (!scanCodes.length) {
    return {
      tickets: selectedTicket ? [selectedTicket] : [],
      missingScanCodes: [],
    }
  }
  const tickets: GeneratedFeiTicketSourceRecord[] = []
  const missingScanCodes: string[] = []
  scanCodes.forEach((scanCode) => {
    const matched = generatedTickets.find((ticket) => generatedTicketMatchesScanCode(ticket, scanCode))
    if (!matched) {
      missingScanCodes.push(scanCode)
      return
    }
    if (!tickets.some((ticket) => ticket.feiTicketId === matched.feiTicketId)) tickets.push(matched)
  })
  return { tickets, missingScanCodes }
}

function getWaitHandoverPickingOptions(): Array<{ value: string; label: string }> {
  return buildWaitHandoverWebPickingProjection().tasks.flatMap((task) => {
    const pickedFeiTicketIds = new Set(task.pickedItems.map((item) => item.feiTicketId))
    return task.allocatedInventoryItems
      .filter((item) => item.voidStatus !== '已作废')
      .filter((item) => !pickedFeiTicketIds.has(item.feiTicketId))
      .slice(0, 6)
      .map((item) => ({
        value: `${task.pickingTaskId}|${item.feiTicketId}`,
        label: `${task.pickingTaskNo} / ${item.feiTicketNo} / ${item.partName} ${item.size} / ${item.pieceQty} 片`,
      }))
  }).slice(0, 30)
}

function waitHandoverPickingItemMatchesScanCode(
  item: HandoverPickingTaskProjection['tasks'][number]['allocatedInventoryItems'][number],
  scanCode: string,
): boolean {
  return [item.feiTicketId, item.feiTicketNo, item.inventoryRecordId].some((value) => String(value || '') === scanCode)
}

function resolveWaitHandoverPickingSelections(
  selectedValue: string,
  scanInput: string,
): {
  task: HandoverPickingTaskProjection['tasks'][number] | null
  items: HandoverPickingTaskProjection['tasks'][number]['allocatedInventoryItems']
  sourceTempBagCode: string
  missingScanCodes: string[]
  mixedTask: boolean
} {
  const selected = findWaitHandoverPickingSelection(selectedValue)
  const scanCodes = splitWaitHandoverScanCodes(scanInput)
  if (!scanCodes.length) {
    return {
      task: selected?.task || null,
      items: selected ? [selected.item] : [],
      sourceTempBagCode: selected?.sourceTempBagCode || '',
      missingScanCodes: [],
      mixedTask: false,
    }
  }
  const projection = buildWaitHandoverWebPickingProjection()
  const matched: Array<{
    task: HandoverPickingTaskProjection['tasks'][number]
    item: HandoverPickingTaskProjection['tasks'][number]['allocatedInventoryItems'][number]
  }> = []
  const missingScanCodes: string[] = []
  scanCodes.forEach((scanCode) => {
    let found: { task: HandoverPickingTaskProjection['tasks'][number]; item: HandoverPickingTaskProjection['tasks'][number]['allocatedInventoryItems'][number] } | null = null
    projection.tasks.some((task) => {
      const item = task.allocatedInventoryItems.find((candidate) => waitHandoverPickingItemMatchesScanCode(candidate, scanCode))
      if (!item) return false
      found = { task, item }
      return true
    })
    if (!found) {
      missingScanCodes.push(scanCode)
      return
    }
    if (!matched.some((entry) => entry.item.feiTicketId === found.item.feiTicketId)) matched.push(found)
  })
  const taskIds = uniqueStrings(matched.map((entry) => entry.task.pickingTaskId))
  const task = matched[0]?.task || selected?.task || null
  return {
    task,
    items: matched.map((entry) => entry.item),
    sourceTempBagCode: matched[0]?.item.tempBagCode || selected?.sourceTempBagCode || task?.tempBagSources[0]?.tempBagCode || '',
    missingScanCodes,
    mixedTask: taskIds.length > 1,
  }
}

type WaitHandoverConfirmSelection = {
  value: string
  handoverOrderId: string
  handoverOrderNo: string
  receiverType: string
  receiverId: string
  receiverName: string
  bagUseId: string
  bagCode: string
  sourceWarehouseName: string
  tickets: Array<{ feiTicketId: string; feiTicketNo: string; pieceQty: number }>
}

function buildWaitHandoverConfirmSelections(): WaitHandoverConfirmSelection[] {
  const projection = buildWaitHandoverWebPickingProjection()
  const taskById = new Map(projection.tasks.map((task) => [task.pickingTaskId, task]))
  const selections: WaitHandoverConfirmSelection[] = []
  projection.tasks.forEach((task) => {
    task.targetTransferBags.forEach((bag) => {
      const tickets = bag.containedFeiTickets
        .filter((ticket) => !runtimeEventHasWaitHandoverTicket('新增交出记录', ticket.feiTicketId))
        .map((ticket) => ({
          feiTicketId: ticket.feiTicketId,
          feiTicketNo: ticket.feiTicketNo,
          pieceQty: ticket.pieceQty,
        }))
      if (!tickets.length) return
      selections.push({
        value: `task-bag|${task.pickingTaskId}|${bag.bagUseId}`,
        handoverOrderId: `WEB-HO-${task.pickingTaskId}`,
        handoverOrderNo: `${task.sewingTaskNo}-交出`,
        receiverType: '工厂',
        receiverId: task.receiverFactoryId,
        receiverName: task.receiverFactoryName,
        bagUseId: bag.bagUseId,
        bagCode: bag.bagCode,
        sourceWarehouseName: task.sourceWarehouseName,
        tickets,
      })
    })
  })
  listRuntimeWaitHandoverEvents()
    .filter((event) => event.eventType === '交出装袋确认')
    .forEach((event) => {
      const payload = toRuntimeRecord(event.payload)
      const task = taskById.get(runtimeString(payload.pickingTaskId))
      const rawTickets = Array.isArray(payload.tickets) ? payload.tickets : []
      const tickets = rawTickets
        .map((rawTicket) => {
          const ticket = toRuntimeRecord(rawTicket)
          return {
            feiTicketId: runtimeString(ticket.feiTicketId),
            feiTicketNo: runtimeString(ticket.feiTicketNo),
            pieceQty: runtimeNumber(ticket.pieceQty),
          }
        })
        .filter((ticket) => ticket.feiTicketId && !runtimeEventHasWaitHandoverTicket('新增交出记录', ticket.feiTicketId))
      if (!tickets.length) return
      selections.push({
        value: `runtime-bag|${event.eventId}`,
        handoverOrderId: `WEB-HO-${runtimeString(payload.pickingTaskId) || event.eventId}`,
        handoverOrderNo: `${runtimeString(payload.sewingTaskNo) || runtimeString(payload.pickingTaskNo) || 'WEB'}-交出`,
        receiverType: '工厂',
        receiverId: task?.receiverFactoryId || '',
        receiverName: task?.receiverFactoryName || runtimeString(payload.receiverName) || '待指定接收对象',
        bagUseId: event.eventId,
        bagCode: runtimeString(payload.targetTransferBagCode) || event.refs.transferBagCode || '待补中转袋',
        sourceWarehouseName: task?.sourceWarehouseName || '裁床待交出仓',
        tickets,
      })
    })
  return selections.slice(0, 30)
}

function getWaitHandoverRecordOptions(): Array<{ value: string; label: string }> {
  return buildWaitHandoverConfirmSelections().map((selection) => ({
    value: selection.value,
    label: `${selection.handoverOrderNo} / ${selection.bagCode} / ${selection.tickets.length} 张菲票 / ${selection.receiverName}`,
  }))
}

function findWaitHandoverConfirmSelection(value: string): WaitHandoverConfirmSelection | null {
  return buildWaitHandoverConfirmSelections().find((selection) => selection.value === value) || null
}

function renderWaitHandoverWebStep(index: number, title: string, done: boolean, active: boolean, body: string): string {
  const sectionClass = done
    ? 'border-emerald-200 bg-emerald-50/70'
    : active
      ? 'border-blue-200 bg-blue-50/60'
      : 'border-border bg-muted/10'
  const badgeClass = done
    ? 'bg-emerald-600 text-white'
    : active
      ? 'bg-blue-600 text-white'
      : 'bg-muted text-muted-foreground'
  return `
    <section class="rounded-lg border p-4 ${sectionClass}">
      <div class="mb-3 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${badgeClass}">${index}</span>
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
      </div>
      ${body}
    </section>
  `
}

function renderWaitHandoverWebActionDialog(action: WaitHandoverWebAction, selectedValue = ''): string {
  const titleMap: Record<WaitHandoverWebAction, string> = {
    inbound: '入仓暂存装袋',
    'handover-bagging-confirm': '交出装袋确认',
    handover: '交出确认',
  }
  const submitMap: Record<WaitHandoverWebAction, string> = {
    inbound: '确认入仓暂存',
    'handover-bagging-confirm': '交出装袋确认',
    handover: '确认交出',
  }
  const inboundTicketOptions = getWaitHandoverTicketOptions()
  const pickingOptions = getWaitHandoverPickingOptions()
  const selectedConfirm = selectedValue ? findWaitHandoverConfirmSelection(selectedValue) : null
  const actionContent = action === 'inbound'
    ? `
      <div class="space-y-3">
        ${renderWaitHandoverWebStep(1, '扫码中转袋二维码', false, true, `
          <div class="grid gap-3 md:grid-cols-[1fr,1fr]">
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">中转袋二维码 / 袋码</span>
              <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="bagCode" value="${escapeHtml(selectedValue || 'WEB-TEMP-BAG-001')}" placeholder="扫描中转袋二维码，或输入 BAG-A-001" />
            </label>
            <div class="rounded-lg border bg-background px-3 py-2 text-sm">
              <div><span class="text-muted-foreground">已选中转袋：</span><span class="font-medium text-foreground">${escapeHtml(selectedValue || '待扫描')}</span></div>
              <div class="mt-1 text-xs text-muted-foreground">当前状态：待确认</div>
              <div class="mt-1 text-xs text-muted-foreground">当前位置：待确认</div>
            </div>
          </div>
        `)}
        ${renderWaitHandoverWebStep(2, '扫码菲票', false, false, `
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">待入仓菲票</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="feiTicketId">
              ${buildWaitHandoverActionSelectOptions(inboundTicketOptions, '暂无待入仓菲票')}
            </select>
          </label>
          <label class="mt-3 block space-y-2">
            <span class="text-sm font-medium text-foreground">菲票码</span>
            <textarea class="min-h-[104px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="ticketScanInput" placeholder="连续扫描多张菲票，或粘贴票号，使用空格 / 换行 / 顿号分隔"></textarea>
          </label>
          <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
            <div>已扫描：<span class="font-medium text-foreground">待提交识别</span></div>
            <div>已识别：<span class="font-medium text-foreground">${escapeHtml(String(inboundTicketOptions.length ? 1 : 0))}</span> 张</div>
            <div>未匹配：<span class="font-medium text-foreground">提交时校验</span></div>
          </div>
        `)}
        ${renderWaitHandoverWebStep(3, '选择库区库位', false, false, `
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label class="space-y-2"><span class="text-sm font-medium text-foreground">库区</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="warehouseArea" value="裁片暂存区" /></label>
            <label class="space-y-2"><span class="text-sm font-medium text-foreground">库位</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="locationCode" value="A-01-01" /></label>
            <label class="space-y-2"><span class="text-sm font-medium text-foreground">操作人</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="operatorName" value="裁床仓管" /></label>
            <label class="space-y-2"><span class="text-sm font-medium text-foreground">备注</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="remark" /></label>
          </div>
        `)}
        <div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">入仓暂存支持一个中转袋混装；确认后完成入仓暂存，中转袋进入所选库区库位。</div>
      </div>
    `
    : action === 'handover'
      ? `
        <div class="space-y-3">
          ${renderWaitHandoverWebStep(1, '选择交出装袋确认记录', Boolean(selectedConfirm), true, `
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">交出装袋确认记录</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="handoverSelection">
                ${buildWaitHandoverActionSelectOptions(getWaitHandoverRecordOptions(), '暂无可交出装袋确认记录', selectedValue)}
              </select>
            </label>
            <div class="mt-3 rounded-lg border bg-background px-3 py-2 text-sm">
              <div><span class="text-muted-foreground">中转袋：</span><span class="font-medium text-foreground">${escapeHtml(selectedConfirm?.bagCode || '待选择')}</span></div>
              <div class="mt-1 text-xs text-muted-foreground">接收对象：${escapeHtml(selectedConfirm?.receiverName || '待确认')}</div>
              <div class="mt-1 text-xs text-muted-foreground">菲票数量：${escapeHtml(String(selectedConfirm?.tickets.length || 0))} 张</div>
            </div>
          `)}
          ${renderWaitHandoverWebStep(2, '交出确认', false, Boolean(selectedConfirm), `
            <label class="space-y-2"><span class="text-sm font-medium text-foreground">操作人</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="operatorName" value="交出仓管" /></label>
            <label class="mt-3 block space-y-2"><span class="text-sm font-medium text-foreground">备注</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="remark" /></label>
          `)}
          <div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">交出确认后，中转袋直接进入“已交出待回收”。</div>
        </div>
      `
      : `
        <div class="space-y-3">
          ${renderWaitHandoverWebStep(1, '扫码中转袋二维码', false, true, `
            <div class="grid gap-3 md:grid-cols-[1fr,1fr]">
              <label class="space-y-2"><span class="text-sm font-medium text-foreground">中转袋二维码 / 袋码</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="targetTransferBagCode" value="WEB-HANDOVER-BAG-001" placeholder="扫描中转袋二维码，或输入 BAG-A-001" /></label>
              <div class="rounded-lg border bg-background px-3 py-2 text-sm">
                <div><span class="text-muted-foreground">已选中转袋：</span><span class="font-medium text-foreground">待扫描</span></div>
                <div class="mt-1 text-xs text-muted-foreground">当前状态：待确认</div>
                <div class="mt-1 text-xs text-muted-foreground">当前位置：待确认</div>
              </div>
            </div>
          `)}
          ${renderWaitHandoverWebStep(2, '扫码菲票', false, false, `
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">交出装袋确认任务 / 菲票</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="pickingSelection">
                ${buildWaitHandoverActionSelectOptions(pickingOptions, '暂无交出装袋确认任务')}
              </select>
            </label>
            <label class="mt-3 block space-y-2">
              <span class="text-sm font-medium text-foreground">菲票码</span>
              <textarea class="min-h-[104px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="ticketScanInput" placeholder="连续扫描多张菲票，或粘贴票号，使用空格 / 换行 / 顿号分隔；不填则使用上方选择的菲票"></textarea>
            </label>
            <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
              <div>已扫描：<span class="font-medium text-foreground">待提交识别</span></div>
              <div>已识别：<span class="font-medium text-foreground">${escapeHtml(String(pickingOptions.length ? 1 : 0))}</span> 张</div>
              <div>未匹配：<span class="font-medium text-foreground">提交时校验</span></div>
            </div>
          `)}
          ${renderWaitHandoverWebStep(3, '交出信息', false, false, `
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label class="space-y-2"><span class="text-sm font-medium text-foreground">来源暂存袋</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="sourceTempBagCode" value="按任务默认来源袋" /></label>
              <label class="space-y-2"><span class="text-sm font-medium text-foreground">绑定对象类型</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="boundObjectType"><option>车缝任务</option><option>特殊工艺交出单</option></select></label>
              <label class="space-y-2"><span class="text-sm font-medium text-foreground">接收对象类型</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="receiverType"><option>工厂</option></select></label>
              <label class="space-y-2"><span class="text-sm font-medium text-foreground">操作人</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="operatorName" value="交出仓管" /></label>
              <label class="space-y-2 xl:col-span-4"><span class="text-sm font-medium text-foreground">备注</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-wait-handover-field="remark" /></label>
            </div>
          `)}
          <div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">交出装袋确认后，记录进入“已装袋待交出”；交出确认作为本记录内部结果处理。</div>
        </div>
      `
  return `
    <div id="${WAIT_HANDOVER_WEB_MODAL_ID}" class="fixed inset-0 z-[130]" data-wait-handover-modal="${escapeHtml(action)}">
      <button type="button" class="absolute inset-0 bg-black/45" data-skip-page-rerender="true" data-wait-handover-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 flex max-h-[88vh] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 class="text-base font-semibold text-foreground">${escapeHtml(titleMap[action])}</h2>
            <p class="mt-1 text-xs text-muted-foreground">Web 端与 PDA 共用裁床待交出仓同一事实账，提交后两端都可查询。</p>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="close-dialog">关闭</button>
        </header>
        <div class="space-y-4 overflow-y-auto px-5 py-4">
          ${actionContent}
        </div>
        <footer class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-skip-page-rerender="true" data-wait-handover-action="close-dialog">取消</button>
          <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-wait-handover-action="submit-${escapeHtml(action)}">${escapeHtml(submitMap[action])}</button>
        </footer>
      </section>
    </div>
  `
}

function openWaitHandoverWebActionDialog(action: WaitHandoverWebAction, selectedValue = ''): void {
  if (typeof document === 'undefined') return
  removeWaitHandoverWebActionDialog()
  ;(document.getElementById('app') || document.body).insertAdjacentHTML('beforeend', renderWaitHandoverWebActionDialog(action, selectedValue))
}

function findWaitHandoverPickingSelection(value: string): {
  task: HandoverPickingTaskProjection['tasks'][number]
  item: HandoverPickingTaskProjection['tasks'][number]['allocatedInventoryItems'][number]
  sourceTempBagCode: string
} | null {
  const [taskId, feiTicketId] = value.split('|')
  const task = buildWaitHandoverWebPickingProjection().tasks.find((item) => item.pickingTaskId === taskId)
  const selectedItem = task?.allocatedInventoryItems.find((item) => item.feiTicketId === feiTicketId)
  if (!task || !selectedItem) return null
  return {
    task,
    item: selectedItem,
    sourceTempBagCode: selectedItem.tempBagCode || task.tempBagSources[0]?.tempBagCode || '',
  }
}

function submitWaitHandoverInbound(dialog: HTMLElement): boolean {
  const feiTicketId = readWaitHandoverWebField(dialog, 'feiTicketId')
  const { tickets, missingScanCodes } = resolveWaitHandoverInboundTickets(
    feiTicketId,
    readWaitHandoverWebField(dialog, 'ticketScanInput'),
  )
  if (!tickets.length) {
    window.alert('请选择或扫描可入仓菲票。')
    return true
  }
  if (missingScanCodes.length) {
    window.alert(`以下菲票未匹配：${missingScanCodes.join('、')}`)
    return true
  }
  const duplicatedTicket = tickets.find((ticket) => runtimeEventHasWaitHandoverTicket('菲票入仓暂存', ticket.feiTicketId))
  if (duplicatedTicket) {
    const record = duplicatedTicket as unknown as Record<string, unknown>
    window.alert(`${String(record.feiTicketNo || record.ticketNo || duplicatedTicket.feiTicketId)} 已入仓，不能重复入仓。`)
    return true
  }
  const unnumberedTicket = tickets.find((ticket) => !validateFeiTicketNumberingBeforeBagging(ticket).ok)
  if (unnumberedTicket) {
    window.alert(validateFeiTicketNumberingBeforeBagging(unnumberedTicket).reason)
    return true
  }
  const bagCode = readWaitHandoverWebField(dialog, 'bagCode') || 'WEB-TEMP-BAG-001'
  appendWaitHandoverInboundEvent({
    source: 'WEB',
    operator: getWaitHandoverWebOperator(dialog),
    bagCode,
    warehouseArea: readWaitHandoverWebField(dialog, 'warehouseArea') || 'B 区',
    locationCode: readWaitHandoverWebField(dialog, 'locationCode') || 'B-02 临时位',
    tickets: tickets.map((ticket) => buildWaitHandoverRuntimeTicketFromGeneratedTicket(ticket)),
  })
  return false
}

function submitWaitHandoverBaggingConfirm(dialog: HTMLElement): boolean {
  const selection = resolveWaitHandoverPickingSelections(
    readWaitHandoverWebField(dialog, 'pickingSelection'),
    readWaitHandoverWebField(dialog, 'ticketScanInput'),
  )
  if (!selection.task || !selection.items.length) {
    window.alert('请选择可交出装袋确认菲票。')
    return true
  }
  if (selection.missingScanCodes.length) {
    window.alert(`以下菲票未匹配：${selection.missingScanCodes.join('、')}`)
    return true
  }
  if (selection.mixedTask) {
    window.alert('交出装袋确认一次只能处理同一个任务下的菲票。')
    return true
  }
  const alreadyPicked = selection.items.find((item) => selection.task?.pickedItems.some((pickedItem) => pickedItem.feiTicketId === item.feiTicketId))
  if (alreadyPicked) {
    window.alert('该菲票已在当前交出装袋确认任务中装袋，不能重复装袋。')
    return true
  }
  const duplicatedTicket = selection.items.find((item) => runtimeEventHasWaitHandoverTicket('交出装袋确认', item.feiTicketId))
  if (duplicatedTicket) {
    window.alert(`${duplicatedTicket.feiTicketNo} 已有交出装袋确认记录，不能重复交出装袋确认。`)
    return true
  }
  const unnumberedTicket = selection.items.find((item) => !validateFeiTicketNumberingBeforeBagging({
    feiTicketId: item.feiTicketId,
    feiTicketNo: item.feiTicketNo,
    partName: item.partName,
  }).ok)
  if (unnumberedTicket) {
    window.alert(validateFeiTicketNumberingBeforeBagging({
      feiTicketId: unnumberedTicket.feiTicketId,
      feiTicketNo: unnumberedTicket.feiTicketNo,
      partName: unnumberedTicket.partName,
    }).reason)
    return true
  }
  const targetTransferBagCode = readWaitHandoverWebField(dialog, 'targetTransferBagCode')
  if (!targetTransferBagCode) {
    window.alert('请填写目标中转袋。')
    return true
  }
  appendWaitHandoverBaggingConfirmEvent({
    source: 'WEB',
    operator: { ...getWaitHandoverWebOperator(dialog), operatorRole: '裁片仓装袋确认员' },
    pickingTaskId: selection.task.pickingTaskId,
    pickingTaskNo: selection.task.pickingTaskNo,
    sewingTaskId: selection.task.sewingTaskId,
    sewingTaskNo: selection.task.sewingTaskNo,
    sourceTempBagCode: selection.sourceTempBagCode || readWaitHandoverWebField(dialog, 'sourceTempBagCode') || '按任务默认来源袋',
    targetTransferBagCode,
    tickets: selection.items.map((item) => ({
      feiTicketId: item.feiTicketId,
      feiTicketNo: item.feiTicketNo,
      pieceQty: item.pieceQty,
    })),
  })
  return false
}

function submitWaitHandoverRecord(dialog: HTMLElement): boolean {
  const selection = findWaitHandoverConfirmSelection(readWaitHandoverWebField(dialog, 'handoverSelection'))
  if (!selection) {
    window.alert('请选择可交出确认的装袋记录。')
    return true
  }
  const tickets = selection.tickets.filter((ticket) => !runtimeEventHasWaitHandoverTicket('新增交出记录', ticket.feiTicketId))
  if (!tickets.length) {
    window.alert('该装袋记录已完成交出确认，不能重复交出。')
    return true
  }
  const now = new Date().toISOString()
  const recordId = `WEB-HR-${selection.handoverOrderId}-${Date.now()}`
  const recordNo = `${selection.handoverOrderNo}-WEB-${String(Date.now()).slice(-4)}`
  const currentHandedOverQty = tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)
  const payload: HandoverRecordSubmitPayload = {
    handoverOrderId: selection.handoverOrderId,
    handoverOrderNo: selection.handoverOrderNo,
    handoverRecordId: recordId,
    handoverRecordNo: recordNo,
    receiverType: selection.receiverType,
    receiverId: selection.receiverId,
    receiverName: selection.receiverName,
    transferBagUses: [{
      bagUseId: selection.bagUseId,
      bagCode: selection.bagCode,
      containedFeiTicketIds: tickets.map((ticket) => ticket.feiTicketId),
      totalPieceQty: currentHandedOverQty,
    }],
    feiTicketItems: tickets.map((ticket) => ({
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      pieceQty: ticket.pieceQty,
      unit: '片',
    })),
    currentHandedOverQty,
    submittedAt: now,
    submittedBy: getWaitHandoverWebOperator(dialog).operatorName,
  }
  appendWaitHandoverHandoverRecordEvent({
    source: 'WEB',
    operator: { ...getWaitHandoverWebOperator(dialog), operatorRole: '裁片仓交出员' },
    payload,
    fromWarehouseArea: selection.sourceWarehouseName,
    fromLocationCode: selection.bagCode,
    occurredAt: now,
  })
  return false
}

export function handleCraftCuttingWaitHandoverEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-wait-handover-action]')
  const action = actionNode?.dataset.waitHandoverAction
  if (!action) return false
  if (action === 'close-dialog') {
    removeWaitHandoverWebActionDialog()
    return true
  }
  if (action === 'open-inbound' || action === 'open-handover-bagging-confirm' || action === 'open-handover') {
    openWaitHandoverWebActionDialog(action.replace('open-', '') as WaitHandoverWebAction, actionNode?.dataset.waitHandoverSelection || '')
    return true
  }
  const dialog = actionNode?.closest<HTMLElement>('[data-wait-handover-modal]')
  if (!dialog) return false
  const blocked =
    action === 'submit-inbound' ? submitWaitHandoverInbound(dialog) :
    action === 'submit-handover-bagging-confirm' ? submitWaitHandoverBaggingConfirm(dialog) :
    action === 'submit-handover' ? submitWaitHandoverRecord(dialog) :
    true
  if (blocked) return true
  removeWaitHandoverWebActionDialog()
  requestWaitHandoverWebRefresh()
  return true
}

function renderWaitHandoverInventoryTable(
  records: InboundTempBagInventoryRecord[],
  reservedQtyByRecord: Map<string, number>,
  runtimeEvents: CuttingRuntimeEvent[],
): string {
  if (!records.length) {
    return '<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">暂无裁床待交出仓库存。</div>'
  }
  const rows = records.map((record) => {
    const reservedQty = reservedQtyByRecord.get(record.inventoryRecordId) || 0
    const availableQty = Math.max(record.pieceQty - reservedQty, 0)
    const status = normalizeWaitHandoverInventoryStatus(record, reservedQty)
    const specialCraftStatus = getWaitHandoverSpecialCraftStatus(record)
    return `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 align-top">
          <div class="truncate font-medium text-blue-700" title="${escapeHtml(record.feiTicketNo)}">${escapeHtml(record.feiTicketNo)}</div>
          <div class="mt-1 truncate text-xs text-muted-foreground" title="${escapeHtml(record.productionOrderNo)}">生产单：${escapeHtml(record.productionOrderNo)}</div>
          <div class="mt-1 truncate text-xs text-muted-foreground" title="${escapeHtml(record.cutOrderNo)}">裁片单：${escapeHtml(record.cutOrderNo)}</div>
        </td>
        <td class="px-3 py-3 align-top">
          <div class="truncate font-medium" title="${escapeHtml(record.spuCode)}">${escapeHtml(record.spuCode)}</div>
          <div class="mt-1 truncate text-xs text-muted-foreground">${escapeHtml(record.color)} / ${escapeHtml(record.size)} / ${escapeHtml(record.partName)}</div>
          <div class="mt-1 truncate text-xs text-muted-foreground">件序：${escapeHtml(record.pieceSequenceLabel || '按菲票追踪')}</div>
        </td>
        <td class="px-3 py-3 align-top text-xs">
          <div class="font-semibold tabular-nums text-emerald-700">当前库存：${escapeHtml(formatPieceQty(record.pieceQty))}</div>
          <div class="mt-1 text-muted-foreground">已占用：${escapeHtml(formatPieceQty(reservedQty))}</div>
          <div class="mt-1 text-muted-foreground">可交出：${escapeHtml(formatPieceQty(availableQty))}</div>
        </td>
        <td class="px-3 py-3 align-top text-xs">
          <div class="truncate font-medium" title="${escapeHtml(record.tempBagCode || '无暂存袋')}">${escapeHtml(record.tempBagCode || '无暂存袋')}</div>
          <div class="mt-1 truncate text-muted-foreground" title="${escapeHtml(`${record.warehouseArea} / ${record.locationCode}`)}">${escapeHtml(`${record.warehouseArea} / ${record.locationCode}`)}</div>
          <div class="mt-1 truncate text-muted-foreground">入仓：${escapeHtml(record.inboundAt || '-')}</div>
        </td>
        <td class="px-3 py-3 align-top text-xs">
          <div class="truncate font-medium" title="${escapeHtml(specialCraftStatus)}">${escapeHtml(specialCraftStatus)}</div>
          <div class="mt-1 truncate text-muted-foreground" title="${escapeHtml(record.receiverFactoryDisplay || '-')}">接收对象：${escapeHtml(record.receiverFactoryDisplay || '-')}</div>
          <span class="mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium text-slate-700">${escapeHtml(status)}</span>
        </td>
        <td class="px-3 py-3 align-top">
          <div class="flex flex-col gap-2">
            ${renderWarehouseFlowButton(`${record.feiTicketNo} 库存流水`, buildWaitHandoverFlowLines(record, runtimeEvents), '查看流水')}
            <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted">调整库位</button>
          </div>
        </td>
      </tr>
    `
  }).join('')
  return `
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-base font-semibold">待交出仓裁片库存</h2>
        <span class="text-xs text-muted-foreground">共 ${records.length} 条库存记录</span>
      </div>
      <div class="max-h-[32rem] overflow-y-auto">
        <table class="w-full table-fixed text-left text-sm">
          <colgroup>
            <col class="w-[17%]" />
            <col class="w-[24%]" />
            <col class="w-[18%]" />
            <col class="w-[18%]" />
            <col class="w-[15%]" />
            <col class="w-[8%]" />
          </colgroup>
          <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">菲票 / 来源</th>
              <th class="px-3 py-2 font-medium">款式 / 裁片</th>
              <th class="px-3 py-2 font-medium">数量账</th>
              <th class="px-3 py-2 font-medium">袋码 / 库位</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `
}

function renderWaitHandoverEventTable(events: CuttingRuntimeEvent[], emptyText: string): string {
  if (!events.length) return `<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  const rows = events.map((event) => [
    getWaitHandoverEventSourceText(event),
    getWaitHandoverEventTypeLabel(event.eventType),
    event.refs.productionOrderNo || '按事件追踪',
    event.refs.cutOrderNo || '按事件追踪',
    uniqueStrings(event.refs.feiTicketNos || []).join('、') || getWaitHandoverEventBagText(event),
    formatPieceQty(getWaitHandoverEventQty(event)),
    getWaitHandoverEventLocationText(event),
    `${event.operatorName} / ${event.occurredAt}`,
    getWaitHandoverEventStatusText(event),
  ])
  return renderHubTable(
    ['业务来源', '类型', '生产单', '裁片单', '菲票 / 袋码', '数量', '库区 / 库位', '操作人 / 时间', '状态'],
    rows,
    emptyText,
  )
}

function renderLocationRows(scopeLabel: string, rows: Array<[string, string, string, string]>): string {
  const tableHtml = `
    <table class="min-w-[960px] w-full text-left text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
        <tr>
          <th class="px-3 py-2 font-medium">仓库</th>
          <th class="px-3 py-2 font-medium">库区</th>
          <th class="px-3 py-2 font-medium">库位</th>
          <th class="px-3 py-2 font-medium">承载对象</th>
          <th class="px-3 py-2 font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(([warehouse, area, location, object]) => `
            <tr class="border-b last:border-b-0">
              <td class="px-3 py-3">${escapeHtml(warehouse)}</td>
              <td class="px-3 py-3">${escapeHtml(area)}</td>
              <td class="px-3 py-3">${escapeHtml(location)}</td>
              <td class="px-3 py-3">${escapeHtml(object)}</td>
              <td class="px-3 py-3">${renderWarehouseLocationActions(scopeLabel, `${area}/${location}`)}</td>
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `
  return `
    <div class="rounded-lg border bg-card">
      ${renderStickyTableScroller(tableHtml, 'max-h-[28rem]')}
    </div>
  `
}

function readTabKey<T extends string>(fallback: T, supportedTabs: readonly T[]): T {
  const raw = getWarehouseSearchParams().get('tab')
  return supportedTabs.includes(raw as T) ? (raw as T) : fallback
}

function buildHubTabHref(
  pageKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover',
  tabKey: string,
): string {
  const basePath = getCanonicalCuttingPath(pageKey)
  if (tabKey === 'overview') return basePath
  if (pageKey === 'warehouse-management-wait-handover' && tabKey === 'inventory') return basePath
  return `${basePath}?tab=${encodeURIComponent(tabKey)}`
}

function renderHubTabs(
  pageKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover',
  activeTab: string,
  tabs: Array<{ key: string; label: string }>,
): string {
  return `
    <section class="rounded-lg border bg-card p-2">
      <div class="flex flex-wrap gap-2">
        ${tabs
          .map((tab) => {
            const isActive = tab.key === activeTab
            return `
              <button
                type="button"
                class="rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'border bg-background text-slate-700 hover:bg-muted'}"
                data-nav="${escapeHtml(buildHubTabHref(pageKey, tab.key))}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderHubShell(options: {
  metaKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover'
  description: string
  kpis: string
  tabs: string
  content: string
  headerActions?: string
}): string {
  const meta = getCanonicalCuttingMeta('', options.metaKey)
  return `
    <div class="space-y-5">
      ${renderCuttingPageHeader(meta, { actionsHtml: options.headerActions })}
      ${options.kpis.trim() ? `<section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">${options.kpis}</section>` : ''}
      ${options.tabs}
      ${options.content}
    </div>
  `
}

type WaitHandoverWorkbenchItemType =
  | '待入仓确认'
  | '待交出装袋确认'
  | '待新增交出记录'
  | '接收差异 / 交出后缺口'

interface WaitHandoverOverviewCard {
  label: string
  value: string | number
  hint: string
  tone: string
}

interface WaitHandoverWorkbenchItem {
  itemId: string
  itemType: WaitHandoverWorkbenchItemType
  urgentLevel: string
  updatedAt: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  feiTicketIds: string[]
  feiTicketNos: string[]
  spuCode: string
  color: string
  size: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  hasSpecialCraft: boolean
  specialCraftDisplay: string
  receiverFactoryDisplay: string
  currentWarehouseArea: string
  tempBagCodes: string[]
  targetTaskId: string
  targetReceiver: string
  shortageAfterHandover: string
  nextAction: string
  nextActionHref: string
  evidenceLines: string[]
}

interface WaitHandoverWorkbenchProjection {
  overviewCards: WaitHandoverOverviewCard[]
  pendingInboundItems: WaitHandoverWorkbenchItem[]
  pendingBaggingConfirmItems: WaitHandoverWorkbenchItem[]
  pendingHandoverRecordItems: WaitHandoverWorkbenchItem[]
  discrepancyAndShortageItems: WaitHandoverWorkbenchItem[]
  specialCraftHandoverGroups: SpecialCraftHandoverGroup[]
  specialCraftReturnProjection: SpecialCraftReturnProjection
  inboundTempBags: InboundTempBag[]
  inboundInventoryRecords: InboundTempBagInventoryRecord[]
  specialCraftReturnInventoryRecords: InboundTempBagInventoryRecord[]
  sewingAllocationProjection: SewingTaskAllocationProjection
  handoverPickingProjection: HandoverPickingTaskProjection
  inventorySnapshot: {
    pieceQty: number
    itemCount: number
    unassignedCount: number
  }
  tempBagSnapshot: {
    tempBagCount: number
    bagCount: number
    tempBagCodes: string[]
    totalPieceQty: number
    mixedBagCount: number
    discrepancyCount: number
  }
  specialCraftSnapshot: {
    waitingReturnCount: number
    returnedCount: number
    differenceCount: number
    hint: string
  }
  handoverSnapshot: {
    handoverOrderCount: number
    handoverRecordCount: number
    shortageCount: number
    discrepancyCount: number
  }
  updatedAt: string
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

function formatPieceQty(value: number): string {
  return `${formatNumber(value)} 片`
}

function getRuntimeBaggingConfirmEventsForTask(task: HandoverPickingTask, runtimeEvents: CuttingRuntimeEvent[]): CuttingRuntimeEvent[] {
  return runtimeEvents.filter((event) => {
    if (event.eventType !== '交出装袋确认') return false
    const payload = toRuntimeRecord(event.payload)
    return (
      runtimeString(payload.pickingTaskId) === task.pickingTaskId ||
      runtimeString(payload.pickingTaskNo) === task.pickingTaskNo ||
      runtimeString(payload.sewingTaskId) === task.sewingTaskId ||
      runtimeString(payload.sewingTaskNo) === task.sewingTaskNo
    )
  })
}

function getRuntimeBaggingConfirmTicketCount(events: CuttingRuntimeEvent[]): number {
  return events.reduce((total, event) => {
    const payload = toRuntimeRecord(event.payload)
    const containedIds = Array.isArray(payload.containedFeiTicketIds) ? payload.containedFeiTicketIds : []
    const scannedIds = Array.isArray(payload.scannedFeiTicketIds) ? payload.scannedFeiTicketIds : []
    return total + (containedIds.length || scannedIds.length || 1)
  }, 0)
}

function formatBaggingConfirmTargetBagCodes(task: HandoverPickingTask, runtimeEvents: CuttingRuntimeEvent[]): string {
  const codes = uniqueStrings([
    ...task.targetTransferBags.map((bag) => bag.bagCode),
    ...runtimeEvents.map((event) => runtimeString(toRuntimeRecord(event.payload).targetTransferBagCode) || getWaitHandoverEventBagText(event)),
  ])
  return codes.join('、') || '待扫目标中转袋'
}

function formatBaggingConfirmRecordSummary(task: HandoverPickingTask, runtimeEvents: CuttingRuntimeEvent[]): string {
  const mockRecords = task.targetTransferBags.map((bag, index) =>
    `第 ${index + 1} 次：${bag.bagCode} / ${formatPieceQty(bag.totalPieceQty)} / ${bag.packedAt}`,
  )
  const runtimeRecords = runtimeEvents.map((event, index) => {
    const payload = toRuntimeRecord(event.payload)
    const recordIndex = mockRecords.length + index + 1
    const bagCode = runtimeString(payload.targetTransferBagCode) || getWaitHandoverEventBagText(event)
    return `第 ${recordIndex} 次：${bagCode} / ${formatPieceQty(getWaitHandoverEventQty(event))} / ${event.occurredAt.replace('T', ' ').slice(0, 16)}`
  })
  const records = [...mockRecords, ...runtimeRecords]
  return records.length ? records.join('；') : '暂无交出装袋确认记录'
}

function getSpecialCraftDisplay(ticket?: GeneratedFeiTicketSourceRecord): string {
  if (!ticket?.hasSpecialCraft || !ticket.specialCrafts.length) return '无'
  return uniqueStrings(ticket.specialCrafts.map((craft) => craft.craftType || craft.craftName)).join('、') || '无'
}

function getReceiverFactoryDisplay(ticket?: GeneratedFeiTicketSourceRecord): string {
  if (!ticket?.hasSpecialCraft || !ticket.specialCrafts.length) return '无'
  return (
    uniqueStrings(ticket.specialCrafts.map((craft) => craft.receiverFactoryName || '承接工厂待补充')).join('、') ||
    '承接工厂待补充'
  )
}

function buildRuntimeTicketCandidatesFromGeneratedTickets(
  generatedTickets: GeneratedFeiTicketSourceRecord[],
): TransferBagTicketCandidate[] {
  return generatedTickets.map((ticket) => ({
    ticketRecordId: ticket.feiTicketId,
    feiTicketId: ticket.feiTicketId,
    ticketNo: ticket.feiTicketNo,
    printStatus: ticket.printStatus as TransferBagTicketCandidate['printStatus'],
    sourceSpreadingSessionId: ticket.spreadingOrderId || ticket.sourceSpreadingSessionId,
    sourceSpreadingSessionNo: ticket.spreadingOrderNo || ticket.sourceSpreadingSessionNo,
    sourceMarkerId: ticket.sourceMarkerPlanId || ticket.sourceMarkerId,
    sourceMarkerNo: ticket.sourceMarkerPlanNo || ticket.sourceMarkerNo,
    cutOrderId: ticket.cutOrderId,
    cutOrderNo: ticket.cutOrderNo,
    productionOrderId: ticket.productionOrderId,
    productionOrderNo: ticket.productionOrderNo,
    markerPlanId: ticket.sourceMarkerPlanId,
    markerPlanNo: ticket.sourceMarkerPlanNo,
    styleCode: ticket.sourceTechPackSpuCode || ticket.skuCode,
    spuCode: ticket.sourceTechPackSpuCode || ticket.skuCode,
    fabricRollNo: ticket.fabricRollNo,
    fabricColor: ticket.fabricColor,
    color: ticket.skuColor || ticket.fabricColor,
    size: ticket.skuSize,
    partCode: ticket.partCode,
    partName: ticket.partName,
    bundleNo: ticket.bundleNo,
    qty: ticket.qty,
    actualCutPieceQty: ticket.actualCutPieceQty,
    garmentQty: ticket.garmentQty,
    materialSku: ticket.materialSku,
    materialAlias: ticket.materialIdentity.materialAlias,
    materialImageUrl: ticket.materialIdentity.materialImageUrl,
    pieceSequenceLabel: ticket.pieceSequenceLabel,
    hasSpecialCraft: ticket.hasSpecialCraft,
    specialCraftDisplayLabel: ticket.specialCraftDisplayLabel,
    receiverFactoryDisplay: getReceiverFactoryDisplay(ticket),
    sourceContextType: '实际裁剪产出',
    ticketStatus: ticket.printStatus === 'VOIDED' ? 'VOIDED' : 'PRINTED',
  }))
}

function createWaitHandoverItemFromTicket(
  candidate: TransferBagTicketCandidate,
  generatedTicket: GeneratedFeiTicketSourceRecord | undefined,
  options: {
    itemType: WaitHandoverWorkbenchItemType
    targetTaskId?: string
    targetReceiver?: string
    currentWarehouseArea?: string
    tempBagCodes?: string[]
    shortageAfterHandover?: string
    nextAction: string
    nextActionHref: string
    evidenceLines?: string[]
  },
): WaitHandoverWorkbenchItem {
  return {
    itemId: `${options.itemType}-${candidate.ticketRecordId}`,
    itemType: options.itemType,
    urgentLevel: '普通',
    updatedAt: generatedTicket?.issuedAt || '最近更新',
    productionOrderId: candidate.productionOrderId,
    productionOrderNo: candidate.productionOrderNo,
    cutOrderId: candidate.cutOrderId,
    cutOrderNo: candidate.cutOrderNo,
    spreadingOrderId: generatedTicket?.spreadingOrderId || candidate.sourceSpreadingSessionId,
    spreadingOrderNo: generatedTicket?.spreadingOrderNo || candidate.sourceSpreadingSessionNo,
    feiTicketIds: [candidate.feiTicketId],
    feiTicketNos: [candidate.ticketNo],
    spuCode: candidate.spuCode || generatedTicket?.sourceTechPackSpuCode || '未关联 SPU',
    color: candidate.color || candidate.fabricColor || generatedTicket?.skuColor || '未标记',
    size: candidate.size || generatedTicket?.skuSize || '未标记',
    partName: candidate.partName || generatedTicket?.partName || '未标记',
    pieceQty: Number(candidate.actualCutPieceQty || candidate.qty || generatedTicket?.actualCutPieceQty || 0),
    pieceSequenceLabel: generatedTicket?.pieceSequenceLabel || generatedTicket?.pieceSetNoRange || '按菲票追踪',
    hasSpecialCraft: Boolean(generatedTicket?.hasSpecialCraft),
    specialCraftDisplay: getSpecialCraftDisplay(generatedTicket),
    receiverFactoryDisplay: getReceiverFactoryDisplay(generatedTicket),
    currentWarehouseArea: options.currentWarehouseArea || '裁床待交出仓',
    tempBagCodes: options.tempBagCodes || [],
    targetTaskId: options.targetTaskId || '',
    targetReceiver: options.targetReceiver || '',
    shortageAfterHandover: options.shortageAfterHandover || '交出后计算',
    nextAction: options.nextAction,
    nextActionHref: options.nextActionHref,
    evidenceLines: options.evidenceLines || [],
  }
}

function createWaitHandoverItemFromPickingTask(
  task: HandoverPickingTask,
  itemType: WaitHandoverWorkbenchItemType,
  nextAction: string,
  nextActionHref: string,
): WaitHandoverWorkbenchItem {
  const firstAllocated = task.allocatedInventoryItems[0]
  const totalPickedQty = task.pickedItems.reduce((total, item) => total + item.pickedQty, 0)
  const shortagePreview = task.shortageItems
    .slice(0, 2)
    .map((item) => `${item.size}/${item.partName} 缺 ${formatPieceQty(item.shortageQty)}`)
    .join('；') || '暂无缺口'

  return {
    itemId: `${itemType}-${task.pickingTaskId}`,
    itemType,
    urgentLevel: task.shortageItems.length ? '高' : '普通',
    updatedAt: task.updatedAt,
    productionOrderId: '',
    productionOrderNo: firstAllocated?.feiTicketNo ? '按菲票来源追踪' : '待关联生产单',
    cutOrderId: '',
    cutOrderNo: firstAllocated?.feiTicketNo ? '按分配库存追踪' : '待关联裁片单',
    spreadingOrderId: '',
    spreadingOrderNo: '',
    feiTicketIds: task.allocatedInventoryItems.map((item) => item.feiTicketId),
    feiTicketNos: task.allocatedInventoryItems.map((item) => item.feiTicketNo),
    spuCode: task.sewingTaskNo,
    color: '按配料任务汇总',
    size: firstAllocated?.size || '多尺码',
    partName: firstAllocated?.partName || '多部位',
    pieceQty: totalPickedQty || task.allocatedInventoryItems.reduce((total, item) => total + item.pieceQty, 0),
    pieceSequenceLabel: firstAllocated?.pieceSequenceLabel || '按菲票追踪',
    hasSpecialCraft: task.allocatedInventoryItems.some((item) => item.specialCraftReturnStatus !== '不需要特殊工艺'),
    specialCraftDisplay: task.allocatedInventoryItems.some((item) => item.specialCraftReturnStatus !== '不需要特殊工艺') ? '特殊工艺已回仓或已排除' : '无',
    receiverFactoryDisplay: task.receiverFactoryName,
    currentWarehouseArea: task.sourceWarehouseName,
    tempBagCodes: task.tempBagSources.map((item) => item.tempBagCode),
    targetTaskId: task.pickingTaskNo,
    targetReceiver: task.receiverFactoryName,
    shortageAfterHandover: shortagePreview,
    nextAction,
    nextActionHref,
    evidenceLines: [
      `车缝任务：${task.sewingTaskNo}`,
      `来源暂存袋：${task.tempBagSources.map((item) => item.tempBagCode).join('、') || '待扫描'}`,
      `已装袋：${formatPieceQty(totalPickedQty)}`,
      `目标中转袋：${task.targetTransferBags.map((bag) => bag.bagCode).join('、') || '待交出装袋确认'}`,
      `装袋后缺口：${shortagePreview}`,
    ],
  }
}

function buildWaitHandoverWorkbenchProjection(options: {
  runtimeEvents: CuttingRuntimeEvent[]
  ticketCandidates: TransferBagTicketCandidate[]
  generatedTickets: GeneratedFeiTicketSourceRecord[]
  inboundTempBags: InboundTempBag[]
  inboundInventoryRecords: InboundTempBagInventoryRecord[]
  specialCraftReturnProjection: SpecialCraftReturnProjection
  specialCraftReturnInventoryRecords: InboundTempBagInventoryRecord[]
  sewingAllocationProjection: SewingTaskAllocationProjection
  handoverPickingProjection: HandoverPickingTaskProjection
  specialCraftHandoverGroups: SpecialCraftHandoverGroup[]
  transferBagSummary: { bagCount: number }
}): WaitHandoverWorkbenchProjection {
  const generatedTicketsByNo = Object.fromEntries(options.generatedTickets.map((ticket) => [ticket.feiTicketNo, ticket]))
  const runtimeBaggingConfirmItems = options.runtimeEvents
    .filter((event) => event.eventType === '交出装袋确认')
    .slice(0, 3)
    .map((event) =>
      createWaitHandoverItemFromRuntimeEvent(
        event,
        '待交出装袋确认',
        options.generatedTickets,
        '查看交出装袋确认',
        buildHubTabHref('warehouse-management-wait-handover', 'handover-bagging'),
      ),
    )
  const runtimeHandoverRecordItems = options.runtimeEvents
    .filter((event) => event.eventType === '新增交出记录')
    .slice(0, 3)
    .map((event) =>
      createWaitHandoverItemFromRuntimeEvent(
        event,
        '待交出确认',
        options.generatedTickets,
        '查看交出确认记录',
        buildHubTabHref('warehouse-management-wait-handover', 'handover-bagging'),
      ),
    )
  const runtimeReadyHandoverItems = options.runtimeEvents
    .filter((event) => event.eventType === '交出装袋确认')
    .slice(0, 3)
    .map((event) =>
      createWaitHandoverItemFromRuntimeEvent(
        event,
        '待交出确认',
        options.generatedTickets,
        '交出确认',
        buildHubTabHref('warehouse-management-wait-handover', 'handover-bagging'),
      ),
    )
  const printedCandidates = options.ticketCandidates
    .filter((ticket) => ticket.ticketStatus === 'PRINTED' || ticket.ticketStatus === 'REPRINTED')
    .slice(0, 2)
  const pendingInboundItems = printedCandidates.map((ticket) =>
    createWaitHandoverItemFromTicket(ticket, generatedTicketsByNo[ticket.ticketNo], {
      itemType: '待入仓确认',
      currentWarehouseArea: '待入仓确认区',
      nextAction: '确认入仓 / 查看菲票',
      nextActionHref: '/fcs/craft/cutting/fei-tickets',
      evidenceLines: [
        '已打印菲票，等待裁床待交出仓确认入仓。',
        `打编号状态：${getFeiTicketNumberingStatus(ticket)}`,
        `来源铺布单：${generatedTicketsByNo[ticket.ticketNo]?.spreadingOrderNo || ticket.sourceSpreadingSessionNo}`,
      ],
    }),
  )
  const pendingBaggingConfirmItems = options.handoverPickingProjection.tasks
    .filter((task) => task.taskStatus !== '已装袋待交出' || task.shortageItems.length > 0 || task.targetTransferBags.length > 0)
    .slice(0, 4)
    .map((task) =>
      createWaitHandoverItemFromPickingTask(
        task,
        '待交出装袋确认',
        '去交出装袋确认',
        buildHubTabHref('warehouse-management-wait-handover', 'handover-bagging'),
      ),
    )
    .concat(runtimeBaggingConfirmItems)
  const pendingHandoverRecordItems = options.handoverPickingProjection.tasks
    .filter((task) => task.targetTransferBags.length > 0)
    .slice(0, 2)
    .map((task) =>
      createWaitHandoverItemFromPickingTask(
        task,
        '待交出确认',
        '交出确认',
        buildHubTabHref('warehouse-management-wait-handover', 'handover-bagging'),
      ),
    )
    .concat(runtimeReadyHandoverItems)
  const discrepancyAndShortageItems = runtimeHandoverRecordItems.map((item) => ({
    ...item,
    itemType: '接收差异 / 交出后缺口' as const,
    nextAction: '查看交出记录',
    shortageAfterHandover: '交出后计算，等待接收方回写',
    evidenceLines: item.evidenceLines.concat('接收回写后在交出记录内展示差异、异议和交出后缺口。'),
  }))
  const tempBagCodes = uniqueStrings(options.inboundTempBags.map((bag) => bag.bagCode))
  const inboundTempPieceQty = options.inboundTempBags.reduce((sum, bag) => sum + bag.totalPieceQty, 0)
  const specialCraftReturnPieceQty = options.specialCraftReturnInventoryRecords.reduce((sum, record) => sum + record.pieceQty, 0)
  const inboundTempDiscrepancyCount = options.inboundTempBags.reduce((sum, bag) => sum + bag.discrepancyRecords.length, 0)
  const waitingReturnCount = options.specialCraftReturnProjection.summary.waitingReturnCount
  const returnedCount = options.specialCraftReturnProjection.summary.returnedCount
  const differenceCount = options.specialCraftReturnProjection.summary.discrepancyCount
  const specialCraftHandoverGroups = options.specialCraftHandoverGroups
  const readySpecialCraftGroups = specialCraftHandoverGroups.filter((group) => group.canCreateHandover).length
  const shortageCount = discrepancyAndShortageItems.filter((item) => item.shortageAfterHandover.includes('缺')).length
  const inventoryPieceQty = inboundTempPieceQty + specialCraftReturnPieceQty
  const inventoryItemCount = options.inboundInventoryRecords.length + options.specialCraftReturnInventoryRecords.length
  const handoverOrderCount = uniqueStrings(
    options.runtimeEvents
      .filter((event) => event.eventType === '新增交出记录')
      .map((event) => runtimeString(toRuntimeRecord(event.payload).handoverOrderNo) || event.refs.handoverOrderId),
  ).length
  const overviewCards: WaitHandoverOverviewCard[] = [
    { label: '待入仓确认裁片数量', value: formatPieceQty(pendingInboundItems.reduce((sum, item) => sum + item.pieceQty, 0)), hint: '已打印菲票进入裁后仓前确认', tone: 'text-blue-600' },
    { label: '入仓暂存袋数量', value: options.inboundTempBags.length, hint: `${formatPieceQty(inboundTempPieceQty)} 已入仓暂存`, tone: 'text-slate-700' },
    { label: '裁片库存数量', value: formatPieceQty(inventoryPieceQty), hint: `${inventoryItemCount} 条入仓 / 回仓库存记录`, tone: 'text-emerald-600' },
    { label: '待交出装袋确认任务数量', value: pendingBaggingConfirmItems.length || options.handoverPickingProjection.pendingCount + options.handoverPickingProjection.sortingCount, hint: '车缝任务分配后触发', tone: 'text-amber-600' },
    { label: '已装袋待交出数量', value: pendingHandoverRecordItems.length || options.handoverPickingProjection.packedCount, hint: '交出装袋确认后进入交出', tone: 'text-violet-600' },
    { label: '待新增交出记录数量', value: pendingHandoverRecordItems.length, hint: '齐套不是交出前置条件', tone: 'text-blue-600' },
    { label: '接收差异数量', value: discrepancyAndShortageItems.length, hint: '接收回写和异议提示', tone: 'text-rose-600' },
    { label: '交出后缺口数量', value: shortageCount, hint: '缺口作为交出后结果展示', tone: 'text-orange-600' },
    { label: '特殊工艺待交出归组', value: specialCraftHandoverGroups.length, hint: `${readySpecialCraftGroups} 组可生成通用交出单`, tone: 'text-violet-600' },
  ]
  return {
    overviewCards,
    pendingInboundItems,
    pendingBaggingConfirmItems,
    pendingHandoverRecordItems,
    discrepancyAndShortageItems,
    specialCraftHandoverGroups,
    specialCraftReturnProjection: options.specialCraftReturnProjection,
    inboundTempBags: options.inboundTempBags,
    inboundInventoryRecords: options.inboundInventoryRecords,
    specialCraftReturnInventoryRecords: options.specialCraftReturnInventoryRecords,
    sewingAllocationProjection: options.sewingAllocationProjection,
    handoverPickingProjection: options.handoverPickingProjection,
    inventorySnapshot: {
      pieceQty: inventoryPieceQty,
      itemCount: inventoryItemCount,
      unassignedCount: options.inboundInventoryRecords.filter((record) => record.inventoryStatus === '待分配').length,
    },
    tempBagSnapshot: {
      tempBagCount: options.inboundTempBags.length,
      bagCount: options.transferBagSummary.bagCount,
      tempBagCodes: tempBagCodes.slice(0, 6),
      totalPieceQty: inboundTempPieceQty,
      mixedBagCount: options.inboundTempBags.filter((bag) => bag.mixedFlag).length,
      discrepancyCount: inboundTempDiscrepancyCount,
    },
    specialCraftSnapshot: {
      waitingReturnCount,
      returnedCount,
      differenceCount,
      hint: '特殊工艺未回仓不影响其他已裁出部位交出；回仓后重新进入裁床待交出仓库存。',
    },
    handoverSnapshot: {
      handoverOrderCount,
      handoverRecordCount: runtimeHandoverRecordItems.length,
      shortageCount,
      discrepancyCount: discrepancyAndShortageItems.length,
    },
    updatedAt: new Date().toISOString().slice(0, 10),
  }
}

function renderWaitHandoverItemCard(item: WaitHandoverWorkbenchItem): string {
  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="text-xs text-muted-foreground">${escapeHtml(item.itemType)} · ${escapeHtml(item.updatedAt)}</div>
          <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(item.targetTaskId || item.feiTicketNos[0] || item.cutOrderNo)}</h4>
        </div>
        <button type="button" class="shrink-0 rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(item.nextActionHref)}">${escapeHtml(item.nextAction)}</button>
      </div>
      <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div><span class="font-medium text-foreground">来源：</span>${escapeHtml(item.productionOrderNo)} / ${escapeHtml(item.cutOrderNo || '按任务汇总')}</div>
        <div><span class="font-medium text-foreground">裁片：</span>${escapeHtml(item.spuCode)} ${escapeHtml(item.color)} ${escapeHtml(item.size)} ${escapeHtml(item.partName)} · ${escapeHtml(formatPieceQty(item.pieceQty))}</div>
        <div><span class="font-medium text-foreground">编号范围：</span>${escapeHtml(item.pieceSequenceLabel)}</div>
        <div><span class="font-medium text-foreground">暂存袋：</span>${escapeHtml(item.tempBagCodes.join('、') || '待确认')}</div>
        <div><span class="font-medium text-foreground">特殊工艺：</span>${escapeHtml(item.specialCraftDisplay)}</div>
        <div><span class="font-medium text-foreground">承接工厂：</span>${escapeHtml(item.receiverFactoryDisplay || item.targetReceiver || '待确认')}</div>
        <div><span class="font-medium text-foreground">接收对象：</span>${escapeHtml(item.targetReceiver || '待确认')}</div>
        <div><span class="font-medium text-foreground">交出后缺口：</span>${escapeHtml(item.shortageAfterHandover)}</div>
      </div>
      ${
        item.evidenceLines.length
          ? `<ul class="mt-3 space-y-1 text-xs text-muted-foreground">${item.evidenceLines
              .slice(0, 3)
              .map((line) => `<li>${escapeHtml(line)}</li>`)
              .join('')}</ul>`
          : ''
      }
    </article>
  `
}

function renderWaitHandoverWorkArea(title: string, subtitle: string, items: WaitHandoverWorkbenchItem[], emptyText: string): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(subtitle)}</p>
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">${items.length} 项</span>
      </div>
      <div class="mt-4 space-y-3">
        ${
          items.length
            ? items.slice(0, 3).map((item) => renderWaitHandoverItemCard(item)).join('')
            : `<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
        }
      </div>
    </section>
  `
}

function renderSpecialCraftHandoverArea(groups: SpecialCraftHandoverGroup[]): string {
  return `
    <section class="rounded-lg border bg-card p-4 xl:col-span-2" data-section="special-craft-handover-candidates">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">特殊工艺待交出列表</h3>
          <p class="mt-1 text-xs text-muted-foreground">基于菲票特殊工艺字段、承接工厂和裁床待交出仓库存，归入通用交出单和交出记录。</p>
        </div>
        <span class="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">${groups.length} 组</span>
      </div>
      <div class="mt-4 grid gap-3 lg:grid-cols-2">
        ${
          groups.length
            ? groups.slice(0, 8).map((group) => {
                const feiTicketCount = uniqueStrings(group.candidates.map((item) => item.feiTicketNo)).length
                const statusText = group.handoverRecordNo
                  ? `已生成交出记录 ${group.handoverRecordNo}`
                  : group.canCreateHandover
                    ? '可生成特殊工艺交出单'
                    : group.reasonTexts.join('；') || '不可生成正式交出单'
                const operationText = group.handoverOrderNo
                  ? '查看交出单'
                  : group.canCreateHandover
                    ? '生成特殊工艺交出单'
                    : '补充承接工厂'
                const operationHref = group.handoverOrderId
                  ? `/fcs/craft/cutting/handover-orders/${encodeURIComponent(group.handoverOrderId)}`
                  : '/fcs/craft/cutting/fei-tickets'
                return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(group.craftCategory)} / ${escapeHtml(group.craftType)}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(group.receiverFactoryName)}</h4>
                        <div class="mt-1 text-xs text-muted-foreground">接收对象：${escapeHtml(group.receiverType)} / 承接工厂：${escapeHtml(group.receiverFactoryCode)}</div>
                      </div>
                      <button type="button" class="shrink-0 rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(operationHref)}">${escapeHtml(operationText)}</button>
                    </div>
                    <dl class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">菲票：</span>${feiTicketCount} 张</div>
                      <div><span class="font-medium text-foreground">裁片数量：</span>${escapeHtml(formatPieceQty(group.totalPieceQty))}</div>
                      <div><span class="font-medium text-foreground">通用交出单：</span>${escapeHtml(group.handoverOrderNo || '待生成')}</div>
                      <div><span class="font-medium text-foreground">当前状态：</span>${escapeHtml(statusText)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">候选菲票：</span>${escapeHtml(group.candidates.slice(0, 3).map((item) => `${item.feiTicketNo}/${item.partName}/${item.size}/${item.currentInventoryStatus}`).join('；'))}</div>
                    </dl>
                  </article>
                `
              }).join('')
            : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground lg:col-span-2">暂无特殊工艺待交出候选。</div>'
        }
      </div>
      <div class="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        特殊工艺未回仓不影响其他部位交给车缝厂；中转袋按使用阶段追踪，同一袋码可循环复用。
      </div>
    </section>
  `
}

function renderSpecialCraftReturnRecordCard(record: SpecialCraftReturnRecord): string {
  const returnedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.returnedQty, 0)
  const expectedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.pieceQty, 0)
  const differenceQty = returnedQty - expectedQty
  const firstItem = record.returnedFeiTicketItems[0]
  const nextAction =
    record.returnStatus === '已回仓'
      ? '查看回仓库存'
      : record.returnStatus === '部分回仓'
        ? '继续回仓 / 处理差异'
        : '处理回仓差异'
  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="text-xs text-muted-foreground">${escapeHtml(record.craftCategory)} / ${escapeHtml(record.craftType)} · ${escapeHtml(record.returnedAt)}</div>
          <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(record.returnRecordNo)}</h4>
          <div class="mt-1 text-xs text-muted-foreground">来源交出单：${escapeHtml(record.sourceHandoverOrderNo)} / 来源交出记录：${escapeHtml(record.sourceHandoverRecordNo)}</div>
        </div>
        <span class="rounded-full px-2.5 py-1 text-xs font-medium ${
          record.returnStatus === '已回仓'
            ? 'bg-emerald-100 text-emerald-700'
            : record.returnStatus === '部分回仓'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-rose-100 text-rose-700'
        }">${escapeHtml(record.returnStatus)}</span>
      </div>
      <dl class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div><span class="font-medium text-foreground">承接工厂：</span>${escapeHtml(record.receiverFactoryName)}</div>
        <div><span class="font-medium text-foreground">回仓库区：</span>${escapeHtml(record.receivedWarehouseArea)} / ${escapeHtml(record.receivedLocationCode)}</div>
        <div><span class="font-medium text-foreground">菲票数量：</span>${record.returnedFeiTicketItems.length} 张</div>
        <div><span class="font-medium text-foreground">应回 / 实回：</span>${escapeHtml(formatPieceQty(expectedQty))} / ${escapeHtml(formatPieceQty(returnedQty))}</div>
        <div><span class="font-medium text-foreground">差异数量：</span>${escapeHtml(formatPieceQty(Math.abs(differenceQty)))}</div>
        <div><span class="font-medium text-foreground">回仓人：</span>${escapeHtml(record.returnedBy)}</div>
        <div class="sm:col-span-2"><span class="font-medium text-foreground">菲票：</span>${escapeHtml(record.returnedFeiTicketItems.map((item) => `${item.feiTicketNo}/${item.partName}/${item.size}/${item.returnCheckResult}`).join('；'))}</div>
        <div class="sm:col-span-2"><span class="font-medium text-foreground">可参与车缝分配：</span>${firstItem?.allRequiredCraftsReturned ? '是，已重新进入裁床待交出仓库存' : `暂不可，仍有${escapeHtml(firstItem?.remainingSpecialCrafts.join('、') || '回仓差异')}需处理`}</div>
      </dl>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', record.returnStatus === '已回仓' ? 'assignment' : 'special-craft-return'))}">${escapeHtml(nextAction)}</button>
        <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">确认回仓</button>
      </div>
    </article>
  `
}

function renderSpecialCraftReturnArea(projection: SpecialCraftReturnProjection): string {
  return `
    <section class="space-y-4" data-section="special-craft-return">
      <article class="rounded-lg border bg-card p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 class="text-base font-semibold">特殊工艺回仓</h3>
            <p class="mt-1 text-xs text-muted-foreground">特殊工艺完成后关联原特殊工艺交出单和交出记录；回仓裁片重新进入裁床待交出仓库存。</p>
          </div>
          <span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">${projection.summary.returnRecordCount} 条回仓记录</span>
        </div>
        <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">待回仓</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.waitingReturnCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">已回仓</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.returnedCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">部分回仓</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.partialReturnCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">回仓差异</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.discrepancyCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">回仓库存</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.returnedInventoryCount}</dd></div>
          <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">可参与车缝</dt><dd class="mt-1 text-base font-semibold tabular-nums">${projection.summary.readyForSewingCount}</dd></div>
        </dl>
      </article>

      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h4 class="text-sm font-semibold">待回仓 / 部分回仓</h4>
          <div class="mt-3 space-y-3">
            ${
              projection.records.filter((record) => record.returnStatus !== '已回仓').length
                ? projection.records.filter((record) => record.returnStatus !== '已回仓').map((record) => renderSpecialCraftReturnRecordCard(record)).join('')
                : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">暂无待回仓记录。</div>'
            }
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h4 class="text-sm font-semibold">已回仓库存</h4>
          <div class="mt-3 space-y-3">
            ${
              projection.returnedRecords.length
                ? projection.returnedRecords.map((record) => renderSpecialCraftReturnRecordCard(record)).join('')
                : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">暂无已回仓记录。</div>'
            }
          </div>
        </article>
      </section>

      ${renderHubTable(
        ['回仓记录', '来源交出单', '来源交出记录', '承接工厂', '工艺类型', '菲票', '应回 / 实回', '差异', '回仓状态', '回仓库区', '下一动作'],
        projection.records.map((record) => {
          const expectedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.pieceQty, 0)
          const returnedQty = record.returnedFeiTicketItems.reduce((sum, item) => sum + item.returnedQty, 0)
          return [
            record.returnRecordNo,
            record.sourceHandoverOrderNo,
            record.sourceHandoverRecordNo,
            record.receiverFactoryName,
            record.craftType,
            record.returnedFeiTicketItems.map((item) => item.feiTicketNo).join('、'),
            `${formatPieceQty(expectedQty)} / ${formatPieceQty(returnedQty)}`,
            record.discrepancyItems.length ? record.discrepancyItems.map((item) => `${item.discrepancyType} ${formatPieceQty(Math.abs(item.differenceQty))}`).join('；') : '无',
            record.returnStatus,
            `${record.receivedWarehouseArea} / ${record.receivedLocationCode}`,
            record.returnStatus === '已回仓' ? '进入车缝任务分配' : '处理回仓差异',
          ]
        }),
        '暂无特殊工艺回仓记录',
      )}
    </section>
  `
}

function renderWaitHandoverSnapshotCard(title: string, rows: Array<[string, string | number, boolean?]>): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
      <dl class="mt-4 grid gap-3 sm:grid-cols-3">
        ${rows
          .map(([label, value, fullWidth]) => `
            <div class="rounded-md border bg-background px-3 py-2 ${fullWidth ? 'sm:col-span-3' : ''}">
              <dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt>
              <dd class="mt-1 break-words text-base font-semibold tabular-nums">${escapeHtml(String(value))}</dd>
            </div>
          `)
          .join('')}
      </dl>
    </article>
  `
}

function renderWaitHandoverSnapshot(projection: WaitHandoverWorkbenchProjection): string {
  return `
    <section class="grid gap-4 xl:grid-cols-3">
      ${renderWaitHandoverSnapshotCard('裁片库存快照', [
        ['裁片库存数量', formatPieceQty(projection.inventorySnapshot.pieceQty)],
        ['库存记录数', projection.inventorySnapshot.itemCount],
        ['未分区记录', projection.inventorySnapshot.unassignedCount],
      ])}
      ${renderWaitHandoverSnapshotCard('入仓暂存袋快照', [
        ['入仓暂存袋数量', projection.tempBagSnapshot.tempBagCount],
        ['暂存裁片数量', formatPieceQty(projection.tempBagSnapshot.totalPieceQty)],
        ['混装袋数量', projection.tempBagSnapshot.mixedBagCount],
        ['入仓差异记录', projection.tempBagSnapshot.discrepancyCount],
        ['中转袋总数', projection.tempBagSnapshot.bagCount],
        ['示例暂存袋', projection.tempBagSnapshot.tempBagCodes.join('、') || '暂无', true],
      ])}
      ${renderWaitHandoverSnapshotCard('特殊工艺回仓提示', [
        ['特殊工艺未回仓', projection.specialCraftSnapshot.waitingReturnCount],
        ['特殊工艺已回仓', projection.specialCraftSnapshot.returnedCount],
        ['特殊工艺差异', projection.specialCraftSnapshot.differenceCount],
        ['处理口径', projection.specialCraftSnapshot.hint, true],
      ])}
    </section>
  `
}

function renderInboundTempBagArea(bags: InboundTempBag[], inventoryRecords: InboundTempBagInventoryRecord[]): string {
  const totalInventoryQty = inventoryRecords.reduce((sum, record) => sum + record.pieceQty, 0)
  return `
    <section class="rounded-lg border bg-card p-4" data-section="inbound-temp-bags">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">入仓暂存袋</h3>
          <p class="mt-1 text-xs text-muted-foreground">裁剪后打完菲票先做入仓暂存装袋；中转袋正式支持混装，允许不同生产单、SKU、颜色、尺码、部位和特殊工艺要求混装。</p>
        </div>
        <div class="text-xs text-muted-foreground">已形成库存：${escapeHtml(formatPieceQty(totalInventoryQty))}</div>
      </div>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        ${
          bags.length
            ? bags.slice(0, 4).map((bag) => {
                const productionOrderCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.productionOrderNo)).length
                const cutOrderCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.cutOrderNo)).length
                const partCount = uniqueStrings(bag.containedFeiTickets.map((ticket) => ticket.partName)).length
                const hasSpecialCraft = bag.containedFeiTickets.some((ticket) => ticket.hasSpecialCraft)
                return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(bag.useStage)} · ${escapeHtml(bag.inboundAt || '待记录入仓时间')}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(bag.bagCode)}</h4>
                      </div>
                      <span class="rounded-full px-2.5 py-1 text-xs font-medium ${bag.mixedFlag ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">${bag.mixedFlag ? '混装' : '单一来源'}</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">入仓人：</span>${escapeHtml(bag.inboundBy)}</div>
                      <div><span class="font-medium text-foreground">库区 / 位置：</span>${escapeHtml(bag.warehouseArea)} / ${escapeHtml(bag.locationCode)}</div>
                      <div><span class="font-medium text-foreground">菲票数量：</span>${bag.containedFeiTickets.length} 张</div>
                      <div><span class="font-medium text-foreground">裁片数量：</span>${escapeHtml(formatPieceQty(bag.totalPieceQty))}</div>
                      <div><span class="font-medium text-foreground">生产单：</span>${productionOrderCount} 个</div>
                      <div><span class="font-medium text-foreground">裁片单：</span>${cutOrderCount} 张</div>
                      <div><span class="font-medium text-foreground">部位：</span>${partCount} 个</div>
                      <div><span class="font-medium text-foreground">特殊工艺：</span>${hasSpecialCraft ? '包含特殊工艺裁片' : '无'}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">混装概况：</span>${escapeHtml(bag.mixedSummary)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">后续交出装袋确认：</span>${escapeHtml(bag.nextSortingStatus)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">入仓差异：</span>${bag.discrepancyRecords.length ? `${bag.discrepancyRecords.length} 条待处理` : '无'}</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', 'inventory'))}">查看详情</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">核对</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">处理差异</button>
                    </div>
                  </article>
                `
              }).join('')
            : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">暂无入仓暂存袋。</div>'
        }
      </div>
    </section>
  `
}

function renderSewingAllocationArea(projection: SewingTaskAllocationProjection): string {
  return `
    <section class="rounded-lg border bg-card p-4" data-section="sewing-allocation">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">车缝任务分配</h3>
          <p class="mt-1 text-xs text-muted-foreground">基于裁片库存分配，只读取裁床待交出仓已有菲票 / 裁片库存；不以需求数作为分配来源。</p>
        </div>
        <button type="button" class="rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', 'assignment'))}">进入车缝任务分配</button>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">可分配库存记录</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.availableInventoryCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">可分配裁片数量</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(formatPieceQty(projection.availablePieceQty))}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">库存占用记录</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.reservedInventoryCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">特殊工艺未回仓</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.specialCraftPendingCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">分配后缺口</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.shortageCount}</dd>
        </div>
      </dl>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        ${
          projection.allocations.length
            ? projection.allocations.slice(0, 4).map((allocation) => {
                const allocatedQty = allocation.allocatedItems.reduce((sum, item) => sum + item.pieceQty, 0)
                const shortagePreview = allocation.shortageItems
                  .slice(0, 2)
                  .map((item) => `${item.size}/${item.partName} 缺 ${formatPieceQty(item.shortageQty)}`)
                  .join('；') || '暂无缺口'
                const pendingPreview = allocation.specialCraftPendingItems
                  .slice(0, 2)
                  .map((item) => `${item.partName} ${item.specialCraftType} ${formatPieceQty(item.pendingQty)}`)
                  .join('；') || '无'
                return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(allocation.sourceType)} · ${escapeHtml(allocation.allocationStatus)}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(allocation.sewingTaskNo)}</h4>
                      </div>
                      <span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">基于裁片库存分配</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">分配依据：</span>${escapeHtml(allocation.allocationBasis)}</div>
                      <div><span class="font-medium text-foreground">接收车缝厂：</span>${escapeHtml(allocation.receiverFactoryName)}</div>
                      <div><span class="font-medium text-foreground">SPU / 颜色：</span>${escapeHtml(allocation.spuCode)} / ${escapeHtml(allocation.color)}</div>
                      <div><span class="font-medium text-foreground">裁片数量：</span>${escapeHtml(formatPieceQty(allocatedQty))}</div>
                      <div><span class="font-medium text-foreground">涉及菲票：</span>${allocation.allocatedItems.length} 张</div>
                      <div><span class="font-medium text-foreground">库存占用：</span>${allocation.inventoryReservationIds.length} 条</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">分配后缺口：</span>${escapeHtml(shortagePreview)}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">特殊工艺未回仓：</span>${escapeHtml(pendingPreview)}</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">生成交出装袋确认任务</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">查看分配后缺口</button>
                    </div>
                  </article>
                `
              }).join('')
            : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">暂无可分配裁片库存。</div>'
        }
      </div>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">分配规则</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${projection.ruleNotes.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">特殊工艺未回仓</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${
              projection.specialCraftPendingItems.length
                ? projection.specialCraftPendingItems
                    .slice(0, 4)
                    .map((item) => `<li>${escapeHtml(item.partName)}：${escapeHtml(item.specialCraftType)} / ${escapeHtml(item.receiverFactoryName)}，待回仓 ${escapeHtml(formatPieceQty(item.pendingQty))}</li>`)
                    .join('')
                : '<li>暂无特殊工艺未回仓库存。</li>'
            }
          </ul>
          <h4 class="mt-3 text-sm font-semibold">不参与本次分配</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${
              projection.excludedItems.length
                ? projection.excludedItems
                    .slice(0, 5)
                    .map((item) => `<li>${escapeHtml(item.feiTicketNo)}：${escapeHtml(item.exclusionReason)}</li>`)
                    .join('')
                : '<li>暂无被排除的库存记录。</li>'
            }
          </ul>
          <div class="mt-2 text-xs text-muted-foreground">任务取消释放占用：${projection.releasedReservations.length ? '已有释放记录' : '暂无释放记录'}</div>
        </div>
      </div>
    </section>
  `
}

function renderHandoverPickingArea(projection: HandoverPickingTaskProjection): string {
  return `
    <section class="rounded-lg border bg-card p-4" data-section="handover-picking">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold">交出装袋确认</h3>
          <p class="mt-1 text-xs text-muted-foreground">车缝任务分配后，从裁床待交出仓已有菲票 / 裁片库存中按车缝任务分拣并装入中转袋。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHubTabHref('warehouse-management-wait-handover', 'sorting'))}">打开交出装袋确认任务</button>
          <button type="button" class="rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted" data-nav="/fcs/craft/cutting/transfer-bags">打印袋码</button>
        </div>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">交出装袋确认任务</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.taskCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">分拣中任务</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.sortingCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">已装袋待交出</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.packedCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">目标中转袋</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.targetTransferBagCount}</dd>
        </div>
        <div class="rounded-md border bg-background px-3 py-2">
          <dt class="text-xs text-muted-foreground">PDA 同步失败</dt>
          <dd class="mt-1 text-base font-semibold tabular-nums">${projection.syncFailedCount}</dd>
        </div>
      </dl>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        ${
          projection.tasks.length
            ? projection.tasks.slice(0, 4).map((task) => {
                const requiredQty = task.requiredItems.reduce((total, item) => total + item.requiredQty, 0)
                const allocatedQty = task.allocatedInventoryItems.reduce((total, item) => total + item.pieceQty, 0)
                const pickedQty = task.pickedItems.reduce((total, item) => total + item.pickedQty, 0)
                const packedQty = task.targetTransferBags.reduce((total, bag) => total + bag.totalPieceQty, 0)
                const shortagePreview = task.shortageItems
                  .slice(0, 2)
                  .map((item) => `${item.size}/${item.partName} 缺 ${formatPieceQty(item.shortageQty)}`)
                  .join('；') || '暂无缺口'
                return `
                  <article class="rounded-lg border bg-background p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-xs text-muted-foreground">${escapeHtml(task.taskStatus)} · ${escapeHtml(task.updatedAt)}</div>
                        <h4 class="mt-1 truncate text-sm font-semibold">${escapeHtml(task.pickingTaskNo)}</h4>
                      </div>
                      <span class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">交出装袋确认</span>
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div><span class="font-medium text-foreground">车缝任务：</span>${escapeHtml(task.sewingTaskNo)}</div>
                      <div><span class="font-medium text-foreground">接收工厂：</span>${escapeHtml(task.receiverFactoryName)}</div>
                      <div><span class="font-medium text-foreground">需要数量：</span>${escapeHtml(formatPieceQty(requiredQty))}</div>
                      <div><span class="font-medium text-foreground">已分配库存：</span>${escapeHtml(formatPieceQty(allocatedQty))}</div>
                      <div><span class="font-medium text-foreground">已装袋数量：</span>${escapeHtml(formatPieceQty(pickedQty))}</div>
                      <div><span class="font-medium text-foreground">已装袋数量：</span>${escapeHtml(formatPieceQty(packedQty))}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">来源暂存袋：</span>${escapeHtml(task.tempBagSources.map((item) => item.tempBagCode).join('、') || '待扫描')}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">目标中转袋：</span>${escapeHtml(task.targetTransferBags.map((bag) => bag.bagCode).join('、') || '待交出装袋确认')}</div>
                      <div class="sm:col-span-2"><span class="font-medium text-foreground">装袋后缺口：</span>${escapeHtml(shortagePreview)}</div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">交出装袋确认</button>
                      <button type="button" class="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted">查看缺口</button>
                    </div>
                  </article>
                `
              }).join('')
            : '<div class="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">暂无交出装袋确认任务。</div>'
        }
      </div>
      <div class="mt-4 grid gap-3 xl:grid-cols-2">
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">扫码校验</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${
              projection.scanChecks.length
                ? projection.scanChecks
                    .slice(0, 8)
                    .map((check) => `<li>${escapeHtml(check.scanObject)} ${escapeHtml(check.scannedValue)}：${escapeHtml(check.checkResult)}，${escapeHtml(check.reason)}，同步：${escapeHtml(check.syncStatus)}</li>`)
                    .join('')
                : '<li>暂无扫码校验记录。</li>'
            }
          </ul>
        </div>
        <div class="rounded-lg border bg-background p-3">
          <h4 class="text-sm font-semibold">装袋规则</h4>
          <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
            ${projection.ruleNotes.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>
      </div>
    </section>
  `
}

function renderWaitHandoverWorkbench(projection: WaitHandoverWorkbenchProjection): string {
  return `
    <section class="space-y-4">
      ${renderWaitHandoverSnapshot(projection)}
      ${renderInboundTempBagArea(projection.inboundTempBags, projection.inboundInventoryRecords)}
      ${renderSewingAllocationArea(projection.sewingAllocationProjection)}
      ${renderSpecialCraftHandoverArea(projection.specialCraftHandoverGroups)}
      ${renderSpecialCraftReturnArea(projection.specialCraftReturnProjection)}
      ${renderHandoverPickingArea(projection.handoverPickingProjection)}
      <section class="grid gap-4 xl:grid-cols-2">
        ${renderWaitHandoverWorkArea('待入仓确认', '已打印菲票进入裁床待交出仓前的确认入口。', projection.pendingInboundItems, '暂无待入仓确认菲票。')}
        ${renderWaitHandoverWorkArea('待交出装袋确认', '车缝任务分配后，从入仓暂存袋按任务拣出裁片并装入中转袋。', projection.pendingBaggingConfirmItems, '暂无待交出装袋确认任务。')}
        ${renderWaitHandoverWorkArea('待新增交出记录', '已装袋后新增交出记录；齐套和缺口在交出后计算。', projection.pendingHandoverRecordItems, '暂无待新增交出记录。')}
        <div class="xl:col-span-2">
          ${renderWaitHandoverWorkArea('接收差异 / 交出后缺口', '展示接收回写差异、异议和交出后缺口。', projection.discrepancyAndShortageItems, '暂无接收差异或交出后缺口。')}
        </div>
      </section>
    </section>
  `
}

function listRuntimeWaitHandoverEvents(): CuttingRuntimeEvent[] {
  const events = [
    ...listCuttingRuntimeEventsByInventoryScope('裁床待交出仓'),
    ...listCuttingRuntimeEventsByType('交出装袋确认'),
    ...listCuttingRuntimeEventsByType('新增交出记录'),
    ...listCuttingRuntimeEventsByType('特殊工艺交出'),
    ...listCuttingRuntimeEventsByType('特殊工艺回仓'),
  ]
  const seen = new Set<string>()
  return events
    .filter((event) => {
      if (!event.eventId || seen.has(event.eventId)) return false
      seen.add(event.eventId)
      return true
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
}

function findGeneratedFeiTicket(
  generatedTickets: GeneratedFeiTicketSourceRecord[],
  feiTicketId: string,
  feiTicketNo: string,
): GeneratedFeiTicketSourceRecord | undefined {
  return generatedTickets.find((ticket) =>
    (feiTicketId && ticket.feiTicketId === feiTicketId) ||
    (feiTicketNo && ticket.feiTicketNo === feiTicketNo),
  )
}

function getRuntimeTicketPrintStatus(ticket?: GeneratedFeiTicketSourceRecord): string {
  if (!ticket) return '已打印'
  if (ticket.printStatus === 'WAIT_PRINT') return '待打印'
  if (ticket.printStatus === 'REPRINTED') return '已补打'
  if (ticket.printStatus === 'VOIDED') return '已作废'
  return '已打印'
}

function getRuntimeTicketVoidStatus(ticket?: GeneratedFeiTicketSourceRecord): string {
  return ticket?.printStatus === 'VOIDED' ? '已作废' : '有效'
}

function buildInboundTempBagMixedSummaryFromTickets(tickets: InboundTempBagContainedFeiTicket[]): string {
  const productionOrderCount = uniqueStrings(tickets.map((ticket) => ticket.productionOrderNo)).length
  const cutOrderCount = uniqueStrings(tickets.map((ticket) => ticket.cutOrderNo)).length
  const partCount = uniqueStrings(tickets.map((ticket) => ticket.partName)).length
  const sizeCount = uniqueStrings(tickets.map((ticket) => ticket.size)).length
  const specialCraftCount = tickets.filter((ticket) => ticket.hasSpecialCraft).length
  return `涉及生产单 ${productionOrderCount} 个、裁片单 ${cutOrderCount} 张、部位 ${partCount} 个、尺码 ${sizeCount} 个、特殊工艺菲票 ${specialCraftCount} 张`
}

function buildRuntimeInboundTempBagsFromEvents(
  runtimeEvents: CuttingRuntimeEvent[],
  generatedTickets: GeneratedFeiTicketSourceRecord[],
): InboundTempBag[] {
  return runtimeEvents
    .filter((event) => event.eventType === '菲票入仓暂存')
    .map((event) => {
      const payload = toRuntimeRecord(event.payload)
      const rawItems = Array.isArray(payload.feiTicketItems) ? payload.feiTicketItems : []
      const containedFeiTickets = rawItems.map((rawItem) => {
        const item = toRuntimeRecord(rawItem)
        const feiTicketId = runtimeString(item.feiTicketId)
        const feiTicketNo = runtimeString(item.feiTicketNo)
        const ticket = findGeneratedFeiTicket(generatedTickets, feiTicketId, feiTicketNo)
        return {
          feiTicketId: feiTicketId || ticket?.feiTicketId || event.refs.feiTicketIds?.[0] || '',
          feiTicketNo: feiTicketNo || ticket?.feiTicketNo || event.refs.feiTicketNos?.[0] || '',
          productionOrderId: ticket?.productionOrderId || event.refs.productionOrderId || '',
          productionOrderNo: ticket?.productionOrderNo || event.refs.productionOrderNo || '按菲票事件追踪',
          cutOrderId: runtimeString(item.cutOrderId) || ticket?.cutOrderId || event.refs.cutOrderId || '',
          cutOrderNo: runtimeString(item.cutOrderNo) || ticket?.cutOrderNo || event.refs.cutOrderNo || '按菲票事件追踪',
          spreadingOrderNo: runtimeString(item.spreadingOrderNo) || ticket?.spreadingOrderNo || event.refs.spreadingOrderNo || '',
          spuCode: ticket?.sourceTechPackSpuCode || ticket?.skuCode || '按菲票追踪',
          color: ticket?.skuColor || ticket?.fabricColor || '未标记',
          size: ticket?.skuSize || '未标记',
          partName: ticket?.partName || '未标记',
          pieceQty: runtimeNumber(item.pieceQty) || ticket?.actualCutPieceQty || ticket?.qty || 0,
          pieceSequenceLabel: runtimeString(item.pieceSequenceLabel) || ticket?.pieceSequenceLabel || ticket?.pieceSetNoRange || '按菲票追踪',
          hasSpecialCraft: Boolean(item.hasSpecialCraft) || Boolean(ticket?.hasSpecialCraft),
          specialCraftDisplay: getSpecialCraftDisplay(ticket),
          receiverFactoryDisplay: getReceiverFactoryDisplay(ticket),
          printStatus: getRuntimeTicketPrintStatus(ticket),
          voidStatus: getRuntimeTicketVoidStatus(ticket),
        } satisfies InboundTempBagContainedFeiTicket
      })
      const derivedMixedFlag =
        uniqueStrings(containedFeiTickets.map((ticket) => ticket.productionOrderNo)).length > 1 ||
        uniqueStrings(containedFeiTickets.map((ticket) => ticket.cutOrderNo)).length > 1 ||
        uniqueStrings(containedFeiTickets.map((ticket) => ticket.partName)).length > 1 ||
        uniqueStrings(containedFeiTickets.map((ticket) => ticket.size)).length > 1 ||
        uniqueStrings(containedFeiTickets.map((ticket) => ticket.hasSpecialCraft ? '有特殊工艺' : '无特殊工艺')).length > 1

      return {
        tempBagUseId: runtimeString(payload.tempBagUseId) || event.eventId,
        bagCode: runtimeString(payload.bagCode) || event.refs.transferBagCode || '待补袋码',
        bagMasterId: runtimeString(payload.bagMasterId) || runtimeString(payload.bagCode) || event.refs.transferBagCode || event.eventId,
        useStage: '入仓暂存',
        warehouseId: 'cutting-wait-handover',
        warehouseName: '裁床待交出仓',
        warehouseArea: runtimeString(payload.warehouseArea) || event.inventoryEffect?.toWarehouseArea || '裁床待交出仓',
        locationCode: runtimeString(payload.locationCode) || event.inventoryEffect?.toLocationCode || '待补库位',
        inboundStatus: event.eventStatus,
        inboundAt: runtimeString(payload.inboundAt) || event.occurredAt,
        inboundBy: runtimeString(payload.inboundBy) || event.operatorName,
        inboundSource: '菲票入仓',
        containedFeiTickets,
        totalPieceQty: runtimeNumber(payload.totalPieceQty) || containedFeiTickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0),
        mixedFlag: typeof payload.mixedFlag === 'boolean' ? payload.mixedFlag : derivedMixedFlag,
        mixedSummary: buildInboundTempBagMixedSummaryFromTickets(containedFeiTickets),
        discrepancyRecords: [],
        nextSortingStatus: '未绑定车缝任务，待后续分配后再交出装袋确认',
        remark: `${getWaitHandoverEventSourceText(event)} / ${getWaitHandoverEventStatusText(event)}`,
      } satisfies InboundTempBag
    })
}

function buildRuntimeSpecialCraftReturnInventoryRecordsFromEvents(
  runtimeEvents: CuttingRuntimeEvent[],
  generatedTickets: GeneratedFeiTicketSourceRecord[],
): InboundTempBagInventoryRecord[] {
  return runtimeEvents
    .filter((event) => event.eventType === '特殊工艺回仓')
    .flatMap((event) => {
      const payload = toRuntimeRecord(event.payload)
      const rawItems = Array.isArray(payload.returnedFeiTicketItems) ? payload.returnedFeiTicketItems : []
      return rawItems.map((rawItem) => {
        const item = toRuntimeRecord(rawItem)
        const feiTicketId = runtimeString(item.feiTicketId)
        const feiTicketNo = runtimeString(item.feiTicketNo)
        const ticket = findGeneratedFeiTicket(generatedTickets, feiTicketId, feiTicketNo)
        const returnedQty = runtimeNumber(item.returnedQty) || runtimeNumber(item.pieceQty) || ticket?.actualCutPieceQty || 0
        return {
          inventoryRecordId: `INV-${event.eventId}-${feiTicketId || feiTicketNo}`,
          feiTicketId: feiTicketId || ticket?.feiTicketId || '',
          feiTicketNo: feiTicketNo || ticket?.feiTicketNo || '',
          cutOrderId: ticket?.cutOrderId || event.refs.cutOrderId || '',
          cutOrderNo: ticket?.cutOrderNo || event.refs.cutOrderNo || '按回仓事件追踪',
          productionOrderId: ticket?.productionOrderId || event.refs.productionOrderId || '',
          productionOrderNo: ticket?.productionOrderNo || event.refs.productionOrderNo || '按回仓事件追踪',
          spuCode: ticket?.sourceTechPackSpuCode || ticket?.skuCode || '按菲票追踪',
          color: ticket?.skuColor || ticket?.fabricColor || '未标记',
          size: ticket?.skuSize || '未标记',
          partName: ticket?.partName || '未标记',
          pieceQty: returnedQty,
          pieceSequenceLabel: ticket?.pieceSequenceLabel || ticket?.pieceSetNoRange || '按菲票追踪',
          hasSpecialCraft: false,
          specialCraftDisplay: `${runtimeString(item.craftType) || runtimeString(payload.craftType) || '特殊工艺'}已回仓，可参与车缝任务分配`,
          receiverFactoryDisplay: runtimeString(payload.receiverFactoryName) || getReceiverFactoryDisplay(ticket),
          printStatus: getRuntimeTicketPrintStatus(ticket),
          voidStatus: getRuntimeTicketVoidStatus(ticket),
          tempBagCode: '特殊工艺回仓',
          warehouseArea: runtimeString(payload.warehouseArea) || event.inventoryEffect?.toWarehouseArea || '特殊工艺回仓区',
          locationCode: runtimeString(payload.locationCode) || event.inventoryEffect?.toLocationCode || '待补库位',
          inboundAt: runtimeString(payload.returnedAt) || event.occurredAt,
          inventoryStatus: getRuntimeTicketVoidStatus(ticket) === '已作废' ? '已作废或不可用' : '待分配',
        } satisfies InboundTempBagInventoryRecord
      })
    })
}

function buildRuntimeSpecialCraftHandoverGroups(
  runtimeEvents: CuttingRuntimeEvent[],
  inboundInventoryRecords: InboundTempBagInventoryRecord[],
  generatedTickets: GeneratedFeiTicketSourceRecord[],
): SpecialCraftHandoverGroup[] {
  const handedOverCraftKeys = new Set<string>()
  const returnedCraftKeys = new Set<string>()

  runtimeEvents
    .filter((event) => event.eventType === '特殊工艺交出')
    .forEach((event) => {
      const payload = toRuntimeRecord(event.payload)
      const rawItems = Array.isArray(payload.feiTicketItems) ? payload.feiTicketItems : []
      rawItems.forEach((rawItem) => {
        const item = toRuntimeRecord(rawItem)
        const feiTicketId = runtimeString(item.feiTicketId)
        const specialCraftId = runtimeString(item.specialCraftId)
        if (feiTicketId && specialCraftId) handedOverCraftKeys.add(`${feiTicketId}:${specialCraftId}`)
      })
    })

  runtimeEvents
    .filter((event) => event.eventType === '特殊工艺回仓')
    .forEach((event) => {
      const payload = toRuntimeRecord(event.payload)
      const rawItems = Array.isArray(payload.returnedFeiTicketItems) ? payload.returnedFeiTicketItems : []
      rawItems.forEach((rawItem) => {
        const item = toRuntimeRecord(rawItem)
        const feiTicketId = runtimeString(item.feiTicketId)
        const specialCraftId = runtimeString(item.specialCraftId)
        const returnStatus = runtimeString(item.returnStatus)
        if (feiTicketId && specialCraftId && returnStatus === '已回仓') returnedCraftKeys.add(`${feiTicketId}:${specialCraftId}`)
      })
    })

  const candidates = inboundInventoryRecords.flatMap((record) => {
    const ticket = findGeneratedFeiTicket(generatedTickets, record.feiTicketId, record.feiTicketNo)
    if (!ticket?.hasSpecialCraft || !ticket.specialCrafts.length || record.voidStatus === '已作废') return []
    return ticket.specialCrafts.map((craft) => {
      const specialCraftId = craft.specialCraftId || `${ticket.feiTicketId}-${craft.craftType || craft.craftName}`
      const craftKey = `${ticket.feiTicketId}:${specialCraftId}`
      const receiverFactoryName = craft.receiverFactoryName || '承接工厂待补充'
      const receiverFactoryId = craft.receiverFactoryId || ''
      const receiverFactoryType =
        craft.receiverFactoryType === '特种工艺厂' || craft.craftCategory === '特种工艺'
          ? '特种工艺厂'
          : '辅助工艺厂'
      const isReturned = returnedCraftKeys.has(craftKey)
      const isHandedOver = handedOverCraftKeys.has(craftKey) && !isReturned
      const receiverMissing = !receiverFactoryId || receiverFactoryName === '承接工厂待补充'
      const canCreateHandover = !receiverMissing && !isHandedOver && !isReturned
      return {
        candidateId: `SC-HO-CAND-${record.inventoryRecordId}-${specialCraftId}`,
        feiTicketId: ticket.feiTicketId,
        feiTicketNo: ticket.feiTicketNo,
        inventoryRecordId: record.inventoryRecordId,
        productionOrderId: ticket.productionOrderId,
        productionOrderNo: ticket.productionOrderNo,
        cutOrderId: ticket.cutOrderId,
        cutOrderNo: ticket.cutOrderNo,
        spuCode: ticket.sourceTechPackSpuCode || ticket.skuCode,
        color: ticket.skuColor || ticket.fabricColor,
        size: ticket.skuSize,
        partCode: ticket.partCode,
        partName: ticket.partName,
        pieceQty: record.pieceQty,
        pieceSequenceLabel: ticket.pieceSequenceLabel || ticket.pieceSetNoRange || record.pieceSequenceLabel,
        specialCraftId,
        craftCategory: craft.craftCategory,
        craftType: craft.craftType,
        craftName: craft.craftName || craft.craftType,
        receiverFactoryId,
        receiverFactoryCode: craft.receiverFactoryCode || '',
        receiverFactoryName,
        receiverFactoryType,
        currentInventoryStatus: receiverMissing
          ? '承接工厂待补充'
          : isHandedOver
            ? '特殊工艺加工中'
            : isReturned
              ? '不可用'
              : '在库可分配',
        specialCraftHandoverStatus: receiverMissing
          ? '承接工厂待补充'
          : isHandedOver
            ? '已交出未回仓'
            : isReturned
              ? '不可交出'
              : '待交出',
        specialCraftReturnStatus: isReturned ? '已回仓' : isHandedOver ? '待回仓' : '未回仓',
        canCreateHandover,
        reasonTexts: receiverMissing
          ? ['承接工厂待补充']
          : isHandedOver
            ? ['同一特殊工艺已交出未回仓，不能重复交出']
            : isReturned
              ? ['该特殊工艺已回仓，不需要再次交出']
              : [],
      } satisfies SpecialCraftHandoverGroup['candidates'][number]
    })
  })

  const groupMap = new Map<string, SpecialCraftHandoverGroup>()
  candidates.forEach((candidate) => {
    const groupKey = `${candidate.receiverFactoryId || 'missing'}:${candidate.craftCategory}:${candidate.craftType}`
    const current = groupMap.get(groupKey)
    if (!current) {
      groupMap.set(groupKey, {
        groupId: `SC-HO-GROUP-${groupKey}`,
        craftCategory: candidate.craftCategory,
        craftType: candidate.craftType,
        craftName: candidate.craftName,
        receiverFactoryId: candidate.receiverFactoryId,
        receiverFactoryCode: candidate.receiverFactoryCode,
        receiverFactoryName: candidate.receiverFactoryName,
        receiverType: candidate.receiverFactoryType === '特种工艺厂' ? '特种工艺厂' : '辅助工艺厂',
        candidates: [candidate],
        totalPieceQty: candidate.pieceQty,
        canCreateHandover: candidate.canCreateHandover,
        reasonTexts: candidate.reasonTexts,
      })
      return
    }
    current.candidates.push(candidate)
    current.totalPieceQty += candidate.pieceQty
    current.canCreateHandover = current.candidates.some((item) => item.canCreateHandover)
    current.reasonTexts = uniqueStrings(current.candidates.flatMap((item) => item.reasonTexts))
  })

  return Array.from(groupMap.values())
}

function buildRuntimeReturnSummaryItem(
  ticket: GeneratedFeiTicketSourceRecord | undefined,
  item: Record<string, unknown>,
  pieceQty: number,
  label: '应回' | '实回',
) {
  const partName = ticket?.partName || '未标记部位'
  const size = ticket?.skuSize || '未标记尺码'
  return {
    productionOrderNo: ticket?.productionOrderNo || '',
    cutOrderNo: ticket?.cutOrderNo || '',
    color: ticket?.skuColor || ticket?.fabricColor || '',
    size,
    partCode: ticket?.partCode || '',
    partName,
    pieceQty,
    unit: '片',
    summaryText: `${partName} ${size} ${label} ${formatPieceQty(pieceQty)}`,
  }
}

function buildRuntimeSpecialCraftReturnProjectionFromEvents(
  runtimeEvents: CuttingRuntimeEvent[],
  generatedTickets: GeneratedFeiTicketSourceRecord[],
): SpecialCraftReturnProjection {
  const records: SpecialCraftReturnRecord[] = runtimeEvents
    .filter((event) => event.eventType === '特殊工艺回仓')
    .map((event) => {
      const payload = toRuntimeRecord(event.payload)
      const rawItems = Array.isArray(payload.returnedFeiTicketItems) ? payload.returnedFeiTicketItems : []
      const returnedFeiTicketItems = rawItems.map((rawItem) => {
        const item = toRuntimeRecord(rawItem)
        const feiTicketId = runtimeString(item.feiTicketId)
        const feiTicketNo = runtimeString(item.feiTicketNo)
        const specialCraftId = runtimeString(item.specialCraftId)
        const ticket = findGeneratedFeiTicket(generatedTickets, feiTicketId, feiTicketNo)
        const craft = ticket?.specialCrafts.find((craftItem) =>
          craftItem.specialCraftId === specialCraftId ||
          craftItem.craftType === runtimeString(item.craftType),
        )
        const expectedQty = runtimeNumber(item.expectedQty) || ticket?.actualCutPieceQty || ticket?.qty || 0
        const returnedQty = runtimeNumber(item.returnedQty)
        const remainingSpecialCrafts = (ticket?.specialCrafts || [])
          .filter((craftItem) => craftItem.specialCraftId !== specialCraftId)
          .map((craftItem) => craftItem.craftType || craftItem.craftName)
          .filter(Boolean)
        return {
          feiTicketId: feiTicketId || ticket?.feiTicketId || '',
          feiTicketNo: feiTicketNo || ticket?.feiTicketNo || '',
          inventoryRecordId: `INV-${event.eventId}-${feiTicketId || feiTicketNo}`,
          productionOrderNo: ticket?.productionOrderNo || event.refs.productionOrderNo || '',
          cutOrderNo: ticket?.cutOrderNo || event.refs.cutOrderNo || '',
          spuCode: ticket?.sourceTechPackSpuCode || ticket?.skuCode || '',
          color: ticket?.skuColor || ticket?.fabricColor || '',
          size: ticket?.skuSize || '',
          partCode: ticket?.partCode || '',
          partName: ticket?.partName || '',
          pieceQty: expectedQty,
          returnedQty,
          pieceSequenceLabel: ticket?.pieceSequenceLabel || ticket?.pieceSetNoRange || '',
          specialCraftId,
          craftType: craft?.craftType || runtimeString(payload.craftType) || '特殊工艺',
          receiverFactoryName: runtimeString(payload.receiverFactoryName) || craft?.receiverFactoryName || '承接工厂待补充',
          returnCheckResult: returnedQty === expectedQty ? '正常' : returnedQty < expectedQty ? '部分回仓' : '数量差异',
          allRequiredCraftsReturned: remainingSpecialCrafts.length === 0 && returnedQty === expectedQty,
          remainingSpecialCrafts,
        } satisfies SpecialCraftReturnRecord['returnedFeiTicketItems'][number]
      })
      const expectedReturnSummary = rawItems.map((rawItem, index) => {
        const item = toRuntimeRecord(rawItem)
        const ticket = findGeneratedFeiTicket(generatedTickets, runtimeString(item.feiTicketId), runtimeString(item.feiTicketNo))
        return buildRuntimeReturnSummaryItem(ticket, item, returnedFeiTicketItems[index]?.pieceQty || runtimeNumber(item.expectedQty), '应回')
      })
      const actualReturnSummary = rawItems.map((rawItem, index) => {
        const item = toRuntimeRecord(rawItem)
        const ticket = findGeneratedFeiTicket(generatedTickets, runtimeString(item.feiTicketId), runtimeString(item.feiTicketNo))
        return buildRuntimeReturnSummaryItem(ticket, item, returnedFeiTicketItems[index]?.returnedQty || runtimeNumber(item.returnedQty), '实回')
      })
      const discrepancyItems = returnedFeiTicketItems
        .filter((item) => item.returnedQty !== item.pieceQty)
        .map((item) => ({
          discrepancyId: `SCR-DIFF-${event.eventId}-${item.feiTicketId}`,
          discrepancyType: item.returnedQty < item.pieceQty ? '回仓数量小于交出数量' : '回仓数量大于交出数量',
          expectedQty: item.pieceQty,
          actualQty: item.returnedQty,
          differenceQty: item.returnedQty - item.pieceQty,
          unit: '片',
          feiTicketId: item.feiTicketId,
          sourceHandoverRecordId: runtimeString(payload.sourceHandoverRecordId) || event.refs.handoverRecordId || '',
          returnRecordId: runtimeString(payload.returnRecordId) || event.eventId,
          description: 'PDA 特殊工艺回仓数量与原交出数量不一致。',
          evidencePhotos: [],
          reportedAt: runtimeString(payload.returnedAt) || event.occurredAt,
          reportedBy: runtimeString(payload.returnedBy) || event.operatorName,
          handlingStatus: '待处理',
        } satisfies SpecialCraftReturnRecord['discrepancyItems'][number]))
      const craftType = returnedFeiTicketItems[0]?.craftType || '特殊工艺'
      const craftCategory = craftType.includes('模板') || craftType.includes('激光') || craftType.includes('特种') ? '特种工艺' : '辅助工艺'
      const hasPartial = returnedFeiTicketItems.some((item) => item.returnedQty < item.pieceQty)
      const hasDifference = discrepancyItems.length > 0
      const allReturned = returnedFeiTicketItems.length > 0 && returnedFeiTicketItems.every((item) => item.returnedQty === item.pieceQty)
      return {
        returnRecordId: runtimeString(payload.returnRecordId) || event.eventId,
        returnRecordNo: runtimeString(payload.returnRecordNo) || '回仓记录待补',
        sourceHandoverOrderId: runtimeString(payload.sourceHandoverOrderId) || event.refs.handoverOrderId || '',
        sourceHandoverOrderNo: runtimeString(payload.sourceHandoverOrderNo) || '来源交出单待补',
        sourceHandoverRecordId: runtimeString(payload.sourceHandoverRecordId) || event.refs.handoverRecordId || '',
        sourceHandoverRecordNo: runtimeString(payload.sourceHandoverRecordNo) || '来源交出记录待补',
        receiverFactoryId: runtimeString(payload.receiverFactoryId) || '',
        receiverFactoryCode: runtimeString(payload.receiverFactoryCode) || '',
        receiverFactoryName: runtimeString(payload.receiverFactoryName) || returnedFeiTicketItems[0]?.receiverFactoryName || '承接工厂待补充',
        craftCategory,
        craftType,
        craftName: craftType,
        returnedFeiTicketItems,
        expectedReturnSummary,
        actualReturnSummary,
        discrepancyItems,
        returnStatus: hasDifference ? '回仓差异处理中' : hasPartial ? '部分回仓' : allReturned ? '已回仓' : '待回仓',
        returnedAt: runtimeString(payload.returnedAt) || event.occurredAt,
        returnedBy: runtimeString(payload.returnedBy) || event.operatorName,
        receivedWarehouseId: 'cutting-wait-handover',
        receivedWarehouseName: '裁床待交出仓',
        receivedWarehouseArea: runtimeString(payload.warehouseArea) || event.inventoryEffect?.toWarehouseArea || '特殊工艺回仓区',
        receivedLocationCode: runtimeString(payload.locationCode) || event.inventoryEffect?.toLocationCode || '待补库位',
        createdAt: event.createdAt,
        createdBy: event.operatorName,
        remark: `${getWaitHandoverEventSourceText(event)} / ${getWaitHandoverEventStatusText(event)}`,
      } satisfies SpecialCraftReturnRecord
    })

  const inventoryRecords: SpecialCraftReturnInventoryRecord[] = records.flatMap((record) =>
    record.returnedFeiTicketItems
      .filter((item) => item.returnedQty > 0)
      .map((item) => ({
        inventoryRecordId: item.inventoryRecordId,
        sourceType: '特殊工艺回仓',
        sourceReturnRecordId: record.returnRecordId,
        sourceHandoverOrderId: record.sourceHandoverOrderId,
        sourceHandoverRecordId: record.sourceHandoverRecordId,
        feiTicketId: item.feiTicketId,
        feiTicketNo: item.feiTicketNo,
        productionOrderId: '',
        productionOrderNo: item.productionOrderNo,
        cutOrderId: '',
        cutOrderNo: item.cutOrderNo,
        spuCode: item.spuCode,
        color: item.color,
        size: item.size,
        partName: item.partName,
        pieceQty: item.returnedQty,
        pieceSequenceLabel: item.pieceSequenceLabel,
        warehouseArea: record.receivedWarehouseArea,
        locationCode: record.receivedLocationCode,
        inventoryStatus: record.returnStatus === '已回仓' ? '待分配' : '回仓差异处理中',
        specialCraftReadyForSewing: item.allRequiredCraftsReturned && record.returnStatus === '已回仓',
        inboundAt: record.returnedAt,
        inboundBy: record.returnedBy,
        specialCraftDisplay: `${record.craftType}已回仓`,
        receiverFactoryDisplay: record.receiverFactoryName,
        remainingSpecialCraftDisplay: item.remainingSpecialCrafts.join('、') || '无',
      } satisfies SpecialCraftReturnInventoryRecord)),
  )

  return {
    records,
    inventoryRecords,
    waitingRecords: records.filter((record) => record.returnStatus === '待回仓'),
    returnedRecords: records.filter((record) => record.returnStatus === '已回仓'),
    partialReturnedRecords: records.filter((record) => record.returnStatus === '部分回仓'),
    discrepancyRecords: records.filter((record) => record.returnStatus === '回仓差异处理中'),
    summary: {
      returnRecordCount: records.length,
      waitingReturnCount: records.filter((record) => record.returnStatus === '待回仓').length,
      returnedCount: records.filter((record) => record.returnStatus === '已回仓').length,
      partialReturnCount: records.filter((record) => record.returnStatus === '部分回仓').length,
      discrepancyCount: records.filter((record) => record.returnStatus === '回仓差异处理中').length,
      returnedInventoryCount: inventoryRecords.length,
      readyForSewingCount: inventoryRecords.filter((record) => record.specialCraftReadyForSewing).length,
    },
  }
}

function buildRuntimeHandoverTableProjection(
  runtimeEvents: CuttingRuntimeEvent[],
  generatedTickets: GeneratedFeiTicketSourceRecord[],
): {
  orderRows: string[][]
  recordRows: string[][]
  summary: {
    orderCount: number
    recordCount: number
    totalHandedOverQty: number
    pendingWritebackCount: number
    discrepancyCount: number
  }
} {
  const recordEvents = runtimeEvents
    .filter((event) => event.eventType === '新增交出记录')
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt, 'zh-CN'))
  const cumulativeByOrder = new Map<string, number>()
  const orderGroups = new Map<string, {
    orderNo: string
    receiver: string
    productionOrderNos: Set<string>
    totalQty: number
    recordCount: number
    latestAt: string
    status: string
  }>()

  const recordRows = recordEvents.map((event) => {
    const payload = toRuntimeRecord(event.payload)
    const rawItems = Array.isArray(payload.feiTicketItems) ? payload.feiTicketItems : []
    const feiTicketNos = rawItems.map((rawItem) => runtimeString(toRuntimeRecord(rawItem).feiTicketNo)).filter(Boolean)
    const tickets = feiTicketNos
      .map((feiTicketNo) => findGeneratedFeiTicket(generatedTickets, '', feiTicketNo))
      .filter((ticket): ticket is GeneratedFeiTicketSourceRecord => Boolean(ticket))
    const orderNo = runtimeString(payload.handoverOrderNo) || '交出单待补'
    const recordNo = runtimeString(payload.handoverRecordNo) || '交出记录待补'
    const receiverType = runtimeString(payload.receiverType)
    const receiverName = runtimeString(payload.receiverName) || '待接收方回写'
    const currentQty =
      runtimeNumber(payload.currentHandedOverQty) ||
      rawItems.reduce((sum, rawItem) => sum + runtimeNumber(toRuntimeRecord(rawItem).pieceQty), 0)
    const previousQty = cumulativeByOrder.get(orderNo) || 0
    const cumulativeQty = previousQty + currentQty
    cumulativeByOrder.set(orderNo, cumulativeQty)
    const transferBagCodes = Array.isArray(payload.transferBagUses)
      ? payload.transferBagUses
          .map((rawBag) => runtimeString(toRuntimeRecord(rawBag).bagCode))
          .filter(Boolean)
      : []
    const productionOrderNos = uniqueStrings([
      ...tickets.map((ticket) => ticket.productionOrderNo),
      event.refs.productionOrderNo,
    ])
    const orderGroup = orderGroups.get(orderNo) || {
      orderNo,
      receiver: `${receiverType || '接收对象'} / ${receiverName}`,
      productionOrderNos: new Set<string>(),
      totalQty: 0,
      recordCount: 0,
      latestAt: event.occurredAt,
      status: event.eventStatus === '同步失败' ? '同步失败' : '待接收回写',
    }
    productionOrderNos.forEach((productionOrderNo) => orderGroup.productionOrderNos.add(productionOrderNo))
    orderGroup.totalQty += currentQty
    orderGroup.recordCount += 1
    orderGroup.latestAt = event.occurredAt > orderGroup.latestAt ? event.occurredAt : orderGroup.latestAt
    if (event.eventStatus === '同步失败') orderGroup.status = '同步失败'
    orderGroups.set(orderNo, orderGroup)

    return [
      orderNo,
      productionOrderNos.join('、') || '按菲票追踪',
      recordNo,
      formatPieceQty(previousQty),
      formatPieceQty(currentQty),
      formatPieceQty(cumulativeQty),
      '交出后计算',
      transferBagCodes.join('、') || event.refs.transferBagCode || '按装袋事件追踪',
      event.eventStatus === '同步失败' ? '同步失败' : '待接收回写',
    ]
  })

  const orderRows = Array.from(orderGroups.values())
    .sort((left, right) => right.latestAt.localeCompare(left.latestAt, 'zh-CN'))
    .map((order) => [
      order.orderNo,
      Array.from(order.productionOrderNos).join('、') || '按菲票追踪',
      order.receiver,
      formatPieceQty(order.totalQty),
      `${order.recordCount} 条记录`,
      order.status,
    ])

  return {
    orderRows,
    recordRows: recordRows.slice().reverse(),
    summary: {
      orderCount: orderRows.length,
      recordCount: recordRows.length,
      totalHandedOverQty: Array.from(orderGroups.values()).reduce((sum, order) => sum + order.totalQty, 0),
      pendingWritebackCount: recordRows.length,
      discrepancyCount: recordEvents.filter((event) => event.eventStatus === '同步失败').length,
    },
  }
}

function createWaitHandoverItemFromRuntimeEvent(
  event: CuttingRuntimeEvent,
  itemType: WaitHandoverWorkbenchItemType,
  generatedTickets: GeneratedFeiTicketSourceRecord[],
  nextAction: string,
  nextActionHref: string,
): WaitHandoverWorkbenchItem {
  const payload = toRuntimeRecord(event.payload)
  const feiTicketIds = Array.isArray(payload.scannedFeiTicketIds)
    ? payload.scannedFeiTicketIds.map((item) => runtimeString(item)).filter(Boolean)
    : Array.isArray(payload.containedFeiTicketIds)
      ? payload.containedFeiTicketIds.map((item) => runtimeString(item)).filter(Boolean)
      : event.refs.feiTicketIds || []
  const feiTicketNos = Array.isArray(payload.scannedFeiTicketNos)
    ? payload.scannedFeiTicketNos.map((item) => runtimeString(item)).filter(Boolean)
    : Array.isArray(payload.containedFeiTicketNos)
      ? payload.containedFeiTicketNos.map((item) => runtimeString(item)).filter(Boolean)
      : event.refs.feiTicketNos || []
  const firstTicket = findGeneratedFeiTicket(generatedTickets, feiTicketIds[0] || '', feiTicketNos[0] || '')
  const totalPieceQty =
    runtimeNumber(payload.pickedQty) ||
    runtimeNumber(payload.totalPieceQty) ||
    runtimeNumber(payload.currentHandedOverQty) ||
    (Array.isArray(payload.feiTicketItems)
      ? payload.feiTicketItems.reduce((sum, rawItem) => sum + runtimeNumber(toRuntimeRecord(rawItem).pieceQty), 0)
      : 0) ||
    firstTicket?.actualCutPieceQty ||
    0

  return {
    itemId: `${itemType}-${event.eventId}`,
    itemType,
    urgentLevel: event.eventStatus === '同步失败' ? '高' : '普通',
    updatedAt: event.occurredAt,
    productionOrderId: firstTicket?.productionOrderId || event.refs.productionOrderId || '',
    productionOrderNo: firstTicket?.productionOrderNo || event.refs.productionOrderNo || '按事件账追踪',
    cutOrderId: firstTicket?.cutOrderId || event.refs.cutOrderId || '',
    cutOrderNo: firstTicket?.cutOrderNo || event.refs.cutOrderNo || '按事件账追踪',
    spreadingOrderId: firstTicket?.spreadingOrderId || event.refs.spreadingOrderId || '',
    spreadingOrderNo: firstTicket?.spreadingOrderNo || event.refs.spreadingOrderNo || '',
    feiTicketIds,
    feiTicketNos,
    spuCode: firstTicket?.sourceTechPackSpuCode || firstTicket?.skuCode || runtimeString(payload.sewingTaskNo) || '按事件账追踪',
    color: firstTicket?.skuColor || '多颜色',
    size: firstTicket?.skuSize || '多尺码',
    partName: firstTicket?.partName || '多部位',
    pieceQty: totalPieceQty,
    pieceSequenceLabel: firstTicket?.pieceSequenceLabel || firstTicket?.pieceSetNoRange || '按菲票追踪',
    hasSpecialCraft: Boolean(firstTicket?.hasSpecialCraft),
    specialCraftDisplay: getSpecialCraftDisplay(firstTicket),
    receiverFactoryDisplay: getReceiverFactoryDisplay(firstTicket),
    currentWarehouseArea: event.inventoryEffect?.toWarehouseArea || event.inventoryEffect?.fromWarehouseArea || '裁床待交出仓',
    tempBagCodes: uniqueStrings([
      runtimeString(payload.sourceTempBagCode),
      runtimeString(payload.targetTransferBagCode),
      event.refs.transferBagCode,
    ]),
    targetTaskId:
      runtimeString(payload.pickingTaskNo) ||
      runtimeString(payload.sewingTaskNo) ||
      runtimeString(payload.handoverRecordNo) ||
      runtimeString(payload.handoverOrderNo) ||
      getWaitHandoverEventTypeLabel(event.eventType),
    targetReceiver: runtimeString(payload.receiverName) || runtimeString(payload.receiverFactoryName) || '按事件账追踪',
    shortageAfterHandover: '交出后计算',
    nextAction,
    nextActionHref,
    evidenceLines: [
      `来源：${getWaitHandoverEventSourceText(event)}`,
      `状态：${getWaitHandoverEventStatusText(event)}`,
      `操作人：${event.operatorName || '待记录'}`,
    ],
  }
}

export function renderCraftCuttingWarehouseManagementWaitProcessPage(): string {
  const materialLedgerSummary = buildWaitProcessMaterialLedgerSummary()
  const filters = getWaitProcessFilters()
  const inventoryItems = buildWaitProcessInventoryItems(materialLedgerSummary.rows)
  const filteredInventoryItems = filterWaitProcessInventoryItems(inventoryItems, filters)
  const claimEventTypes: CuttingMaterialLedgerEventType[] = ['CUTTING_CLAIMED']
  const usageEventTypes: CuttingMaterialLedgerEventType[] = ['SPREADING_ACTUAL_CONSUMED']
  const returnEventTypes: CuttingMaterialLedgerEventType[] = ['CUTTING_RETURNED']
  const claimRecordEvents = filterWaitProcessEvents(materialLedgerSummary.rows, claimEventTypes, filters)
  const usageEvents = filterWaitProcessEvents(materialLedgerSummary.rows, usageEventTypes, filters)
  const returnEvents = filterWaitProcessEvents(materialLedgerSummary.rows, returnEventTypes, filters)
  const activeTab = readTabKey<WaitProcessTabKey>('inventory', ['inventory', 'claimRecords', 'usage', 'returns', 'locations'])

  const inventoryContent = `<section class="space-y-4">
    ${renderWaitProcessFilterPanel({ tabKey: 'inventory', filters, inventoryItems })}
    ${renderWaitProcessInventoryTable(filteredInventoryItems)}
    ${renderWaitProcessInventoryDetailDialog(inventoryItems)}
  </section>`
  const claimRecordContent = `<section class="space-y-4">
    ${renderWaitProcessFilterPanel({ tabKey: 'claimRecords', filters, inventoryItems, eventTypes: claimEventTypes })}
    ${renderWaitProcessEventTable(claimRecordEvents, '暂无符合筛选条件的中转仓领料记录。', inventoryItems)}
  </section>`
  const usageContent = `<section class="space-y-4">
    ${renderWaitProcessFilterPanel({ tabKey: 'usage', filters, inventoryItems, eventTypes: usageEventTypes })}
    ${renderWaitProcessEventTable(usageEvents, '暂无符合筛选条件的加工领料记录。', inventoryItems)}
  </section>`
  const returnContent = `<section class="space-y-4">
    ${renderWaitProcessFilterPanel({ tabKey: 'returns', filters, inventoryItems, eventTypes: returnEventTypes })}
    ${renderWaitProcessEventTable(returnEvents, '暂无符合筛选条件的回收入仓记录。', inventoryItems)}
  </section>`
  const locationContent = `<section class="space-y-4">
    <div class="flex justify-end rounded-lg border bg-card p-4">${renderWarehouseLocationToolbar('裁床待加工仓')}</div>
    ${renderLocationRows('裁床待加工仓', [
      ['裁床待加工仓', '面料 A 区', 'FAB-A-01', '待裁面料'],
      ['裁床待加工仓', '面料 B 区', 'FAB-B-02', '补料 / 余料'],
    ])}
  </section>`
  const activeContent =
    activeTab === 'claimRecords'
      ? claimRecordContent
      : activeTab === 'usage'
        ? usageContent
        : activeTab === 'returns'
          ? returnContent
          : activeTab === 'locations'
            ? locationContent
            : inventoryContent

  return renderHubShell({
    metaKey: 'warehouse-management-wait-process',
    description: '基于裁片单数量账查看裁床已领面料库存、锁定、消耗和可用余额。',
    kpis: '',
    tabs: renderWaitProcessTabs(activeTab),
    content: `${activeContent}${renderWaitProcessWarehouseActionDialog(inventoryItems)}`,
    headerActions: renderWaitProcessHeaderActions(),
  })
}

export function renderCraftCuttingWarehouseManagementWaitHandoverPage(): string {
  const generatedTickets = listSpreadingResultGeneratedFeiTickets()
  const runtimeWaitHandoverEvents = listRuntimeWaitHandoverEvents()
  const runtimeInboundTempBags = buildRuntimeInboundTempBagsFromEvents(runtimeWaitHandoverEvents, generatedTickets)
  const fallbackInboundTempBags = buildInboundTempBagsFromTransferBagViewModel(buildTransferBagsProjection().viewModel)
  const inboundTempBags = runtimeInboundTempBags.length ? runtimeInboundTempBags : fallbackInboundTempBags
  const transferBagSummary = { bagCount: uniqueStrings(inboundTempBags.map((bag) => bag.bagCode)).length }
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
  const runtimeSpecialCraftReturnInventoryRecords = buildRuntimeSpecialCraftReturnInventoryRecordsFromEvents(runtimeWaitHandoverEvents, generatedTickets)
  const effectiveInventoryRecords = [
    ...inboundInventoryRecords,
    ...runtimeSpecialCraftReturnInventoryRecords,
  ]
  const inboundTicketIds = new Set(effectiveInventoryRecords.map((record) => record.feiTicketId))
  const ticketCandidates = buildRuntimeTicketCandidatesFromGeneratedTickets(generatedTickets)
    .filter((ticket) => !inboundTicketIds.has(ticket.feiTicketId))
  const specialCraftReturnProjection = buildRuntimeSpecialCraftReturnProjectionFromEvents(runtimeWaitHandoverEvents, generatedTickets)
  const specialCraftHandoverGroups = buildRuntimeSpecialCraftHandoverGroups(runtimeWaitHandoverEvents, inboundInventoryRecords, generatedTickets)
  const sewingAllocationProjection = buildSewingTaskAllocationProjectionFromInventory(effectiveInventoryRecords)
  const handoverPickingProjection = buildHandoverPickingTaskProjectionFromAllocationProjection(sewingAllocationProjection)
  const handoverTableProjection = buildRuntimeHandoverTableProjection(runtimeWaitHandoverEvents, generatedTickets)
  const activeTab = readTabKey<WaitHandoverTabKey>('inventory', [
    'inventory',
    'inbound-bagging',
    'handover-bagging',
    'special-craft-return',
    'locations',
  ])
  const workbenchProjection = buildWaitHandoverWorkbenchProjection({
    runtimeEvents: runtimeWaitHandoverEvents,
    ticketCandidates,
    generatedTickets,
    inboundTempBags,
    inboundInventoryRecords,
    specialCraftReturnProjection,
    specialCraftReturnInventoryRecords: runtimeSpecialCraftReturnInventoryRecords,
    sewingAllocationProjection,
    handoverPickingProjection,
    transferBagSummary,
    specialCraftHandoverGroups,
  })
  const filters = getWaitHandoverFilters()
  const reservedQtyByRecord = buildWaitHandoverReservedQtyMap(handoverPickingProjection)
  const filteredInventoryRecords = filterWaitHandoverInventoryRecords(effectiveInventoryRecords, filters, reservedQtyByRecord)
  const filteredPendingTickets = ticketCandidates
    .filter((ticket) => ticket.ticketStatus !== 'VOIDED')
    .filter((ticket) =>
      includesKeyword([
        ticket.ticketNo,
        ticket.productionOrderNo,
        ticket.cutOrderNo,
        ticket.spuCode,
        ticket.color,
        ticket.size,
        ticket.partName,
        ticket.specialCraftDisplayLabel,
        ticket.receiverFactoryDisplay,
      ], filters.keyword),
    )
  const inboundEvents = filterWaitHandoverEvents(
    runtimeWaitHandoverEvents.filter((event) => event.eventType === '菲票入仓暂存' || event.eventType === '特殊工艺回仓'),
    filters,
  )
  const handoverRecordEvents = filterWaitHandoverEvents(
    runtimeWaitHandoverEvents.filter((event) => event.eventType === '新增交出记录'),
    filters,
  )
  const writebackEvents = filterWaitHandoverEvents(
    runtimeWaitHandoverEvents.filter((event) => event.eventType === '新增交出记录' && event.eventStatus === '同步失败'),
    filters,
  )
  const confirmSelections = buildWaitHandoverConfirmSelections()
  const confirmSelectionByTaskId = new Map<string, string>()
  confirmSelections.forEach((selection) => {
    const [sourceType, taskId] = selection.value.split('|')
    const resolvedTaskId = sourceType === 'task-bag' ? taskId : selection.handoverOrderId.replace(/^WEB-HO-/, '')
    if (resolvedTaskId && !confirmSelectionByTaskId.has(resolvedTaskId)) confirmSelectionByTaskId.set(resolvedTaskId, selection.value)
  })
  const sortingRows = handoverPickingProjection.tasks
    .filter((task) =>
      includesKeyword([
        task.pickingTaskNo,
        task.sewingTaskNo,
        task.receiverFactoryName,
        ...task.allocatedInventoryItems.map((item) => item.feiTicketNo),
        ...task.tempBagSources.map((item) => item.tempBagCode),
        ...task.targetTransferBags.map((bag) => bag.bagCode),
      ], filters.keyword),
    )
    .slice(0, 16)
    .map((task) => {
      const runtimeSortingEvents = getRuntimeBaggingConfirmEventsForTask(task, runtimeWaitHandoverEvents)
      const runtimeTicketCount = getRuntimeBaggingConfirmTicketCount(runtimeSortingEvents)
      const packedTicketCount = task.pickedItems.length + runtimeTicketCount
      const displayStatus =
        packedTicketCount > 0 && packedTicketCount >= task.allocatedInventoryItems.length && task.shortageItems.length === 0
          ? '已装袋待交出'
          : packedTicketCount > 0
            ? '交出装袋确认中'
            : task.taskStatus === '待分拣'
              ? '待交出装袋确认'
              : task.taskStatus === '分拣中'
                ? '交出装袋确认中'
                : task.taskStatus
      return {
        pickingTaskNo: task.pickingTaskNo,
        sewingTaskNo: task.sewingTaskNo,
        sourceTempBags: task.tempBagSources.map((item) => item.tempBagCode).join('、') || '待扫来源暂存袋',
        baggingRecordSummary: formatBaggingConfirmRecordSummary(task, runtimeSortingEvents),
        targetTransferBags: formatBaggingConfirmTargetBagCodes(task, runtimeSortingEvents),
        packedTicketText: `${packedTicketCount}/${task.allocatedInventoryItems.length} 张`,
        receiverName: task.receiverFactoryName,
        shortageText: task.shortageItems.length
          ? task.shortageItems.slice(0, 2).map((item) => `${item.size}/${item.partName}缺${formatPieceQty(item.shortageQty)}`).join('；')
          : '暂无缺口',
        status: displayStatus,
        confirmSelection: confirmSelectionByTaskId.get(task.pickingTaskId) || '',
      } satisfies WaitHandoverBaggingTableRow
    })
  const inboundTempUseRows = filterWaitHandoverInboundTempBags(inboundTempBags, filters).slice(0, 16)
  const projectedSpecialCraftReturnRows = specialCraftReturnProjection.records.slice(0, 16).map((record) => {
    const expectedQty = record.expectedReturnSummary.reduce((sum, item) => sum + item.pieceQty, 0)
    const actualQty = record.actualReturnSummary.reduce((sum, item) => sum + item.pieceQty, 0)
    return [
      record.returnRecordNo,
      record.sourceHandoverRecordNo,
      record.receiverFactoryName,
      record.craftType,
      `${formatPieceQty(expectedQty)} / ${formatPieceQty(actualQty)}`,
      `${record.receivedWarehouseArea} / ${record.receivedLocationCode}`,
      record.returnStatus,
      record.discrepancyItems.length ? `${record.discrepancyItems.length} 条差异` : '无差异',
    ]
  })
  const specialCraftReturnRows = projectedSpecialCraftReturnRows.length
    ? projectedSpecialCraftReturnRows
    : [
        ['SCR-20260324-001', 'HR-CF-20260324-001', '模板工序专属工厂', '模板工序', '128 片 / 128 片', '特殊工艺回仓区 / SP-RETURN-01', '已回仓', '无差异'],
        ['SCR-20260324-002', 'HR-CF-20260324-002', '绣花专属工厂', '绣花', '96 片 / 96 片', '特殊工艺回仓区 / SP-RETURN-02', '已回仓', '无差异'],
        ['SCR-20260323-003', 'HR-CF-20260323-004', '压褶专属工厂', '压褶', '72 片 / 60 片', '差异暂存区 / DIFF-01', '部分回仓', '少回 12 片'],
        ['SCR-20260322-004', 'HR-CF-20260322-006', '激光开袋专属工厂', '激光开袋', '54 片 / 54 片', '特殊工艺回仓区 / SP-RETURN-03', '已回仓', '无差异'],
      ]
  const writebackDifferenceRows = [
    ...workbenchProjection.discrepancyAndShortageItems.map((item) => [
      item.targetTaskId || item.itemId,
      item.productionOrderNo,
      item.feiTicketNos.join('、') || '按交出记录追踪',
      formatPieceQty(item.pieceQty),
      item.targetReceiver || '待接收方回写',
      item.shortageAfterHandover,
      item.urgentLevel,
      item.updatedAt,
    ]),
    ...specialCraftReturnProjection.discrepancyRecords.flatMap((record) =>
      record.discrepancyItems.map((item) => [
        record.returnRecordNo,
        record.sourceHandoverRecordNo,
        item.feiTicketId || '按回仓记录追踪',
        formatPieceQty(Math.abs(item.differenceQty)),
        record.receiverFactoryName,
        item.description,
        item.handlingStatus,
        item.reportedAt,
      ]),
    ),
  ].slice(0, 16)

  const filterPanelOptions = {
    filters,
    inventoryRecords: effectiveInventoryRecords,
    runtimeEvents: runtimeWaitHandoverEvents,
    reservedQtyByRecord,
  }
  const inventoryContent = `<section class="space-y-4">
    ${renderWaitHandoverFilterPanel({ ...filterPanelOptions, tabKey: 'inventory' })}
    ${renderWaitHandoverInventoryTable(filteredInventoryRecords, reservedQtyByRecord, runtimeWaitHandoverEvents)}
  </section>`
  const inboundBaggingContent = `<section class="space-y-4">
    ${renderWaitHandoverFilterPanel({ ...filterPanelOptions, tabKey: 'inbound-bagging' })}
    ${renderWaitHandoverInboundTempUseTable(inboundTempUseRows)}
  </section>`
  const handoverBaggingContent = `<section class="space-y-4">
    ${renderWaitHandoverFilterPanel({ ...filterPanelOptions, tabKey: 'handover-bagging' })}
    ${renderWaitHandoverBaggingTable(sortingRows, '暂无交出装袋确认任务。')}
  </section>`
  const specialCraftReturnContent = `<section class="space-y-4">
    ${renderHubTable(['回仓记录', '来源交出记录', '承接工厂', '工艺', '应回 / 实回', '回仓库位', '状态', '差异'], specialCraftReturnRows, '暂无特殊工艺回仓记录。')}
  </section>`
  const locationContent = `<section class="rounded-lg border bg-card">
    <div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('裁床待交出仓')}</div>
    ${renderLocationRows('裁床待交出仓', [
      ['裁床待交出仓', '待入仓确认区', 'CUT-IN-01', '已打印未入仓菲票'],
      ['裁床待交出仓', '裁片 A 区', 'CUT-A-01', '在库待分配裁片'],
      ['裁床待交出仓', '中转袋暂存区', 'BAG-A-01', '已装袋待交出中转袋'],
      ['裁床待交出仓', '特殊工艺回仓区', 'SP-RETURN-01', '特殊工艺回仓裁片'],
      ['裁床待交出仓', '差异暂存区', 'DIFF-01', '回写差异或数量异常裁片'],
    ])}
  </section>`
  const activeContent =
    activeTab === 'inbound-bagging'
      ? inboundBaggingContent
      : activeTab === 'handover-bagging'
        ? handoverBaggingContent
        : activeTab === 'special-craft-return'
          ? specialCraftReturnContent
          : activeTab === 'locations'
            ? locationContent
            : inventoryContent
  const reservedPieceQty = Array.from(reservedQtyByRecord.values()).reduce((sum, qty) => sum + qty, 0)
  const inventoryPieceQty = effectiveInventoryRecords.reduce((sum, record) => sum + record.pieceQty, 0)
  const firstTaskId = handoverPickingProjection.tasks[0]?.pickingTaskId || 'demo-task'

  return renderHubShell({
    metaKey: 'warehouse-management-wait-handover',
    description: '基于菲票、裁片和中转袋管理待交出仓库存、入仓暂存装袋、交出装袋确认、特殊工艺回仓和库区库位。',
    kpis: [
      renderCompactKpiCard('待入仓菲票', filteredPendingTickets.length, '已打印未确认入仓', 'text-blue-600'),
      renderCompactKpiCard('在库裁片', formatPieceQty(inventoryPieceQty), `${effectiveInventoryRecords.length} 条库存`, 'text-emerald-600'),
      renderCompactKpiCard('已占用裁片', formatPieceQty(reservedPieceQty), '车缝任务占用', 'text-amber-600'),
      renderCompactKpiCard('已装袋待交出', handoverPickingProjection.packedCount, '交出装袋确认完成', 'text-violet-600'),
      renderCompactKpiCard('交出差异', writebackDifferenceRows.length, '同步失败与回仓差异', 'text-rose-600'),
    ]
      .join(''),
    tabs: renderWaitHandoverTabs(activeTab),
    content: activeContent,
    headerActions: renderWaitHandoverHeaderActions(firstTaskId),
  })
}
