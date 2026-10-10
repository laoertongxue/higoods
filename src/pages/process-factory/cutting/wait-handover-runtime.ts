import type { ReleaseTicketDetail } from '../../../data/fcs/cut-piece-release-domain.ts'
import { isFeiTicketSimplyHandedOver } from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { isCutPieceTicketUsable } from '../../../data/fcs/cutting/cut-piece-ticket-validity.ts'
import { mixedBagTicketFields } from '../../../data/fcs/cutting/mixed-transfer-bag-ticket.ts'
import { runRuntimeTaskAction } from '../../../data/fcs/runtime-process-tasks.ts'
import { localDateTimeText } from '../../../utils.ts'
import { listWoolPanelCuttingReceiptSources } from '../../../data/fcs/wool-domain/cutting-receipts.ts'
import {
  appendCuttingRuntimeEventIdempotent,
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  listCuttingRuntimeEvents,
  listCuttingRuntimeEventsByInventoryScope,
  listCuttingRuntimeEventsByType,
  type CuttingRuntimeEvent,
  type AppendCuttingRuntimeEventInput,
  type CuttingRuntimeEventSource,
  type CompleteSpecialCraftHandoverPayload,
  type FeiTicketBagSnapshotItem,
  type FeiTicketBaggingPayload,
  type FeiTicketInboundPayload,
  type RuntimeWarehouseLocationRef,
  type TransferBagInboundPayload,
  type HandoverRecordSubmitPayload,
  type SpecialCraftHandoverPayload,
  type SpecialCraftReturnPayload,
  type TransferBagRepackPayload,
  type TransferBagTicketFactSnapshot,
} from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { createCuttingRuntimeChronologyComparator } from '../../../data/fcs/cutting/cutting-runtime-chronology.ts'
import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../../data/browser-storage.ts'
import {
  deriveTransferBagLifecycle,
  type TransferBagLifecycleCycle,
  type TransferBagLifecycleFact,
  type TransferBagLifecycleView,
} from '../../../data/fcs/cutting/transfer-bag-lifecycle.ts'
import {
  buildNextTransferBagHandoverLeg,
  buildSpecialCraftWholeBagHandoverCanonicalIntent,
  eventTouchesTransferBag,
  isEffectiveTransferBagRecoveryEvent,
  isEffectiveTransferBagScrapEvent,
  isCompleteSuccessfulSpecialCraftHandoverEvent,
  isCompleteSuccessfulSpecialCraftBagReturnEvent,
  isCompleteSuccessfulWholeBagHandoverEvent,
  parseCompleteTransferBagRepackPayload,
  parseTransferBagAuthoritativeLocationFact,
  resolveTransferBagAuthoritativeCurrentLocation,
  resolveTransferBagCurrentUse,
  resolveTransferBagCurrentUsesFromEvents,
  recoverTransferBag,
  submitWholeBagHandover,
  submitTransferBagRepack,
  submitSpecialCraftBagReturn,
  submitSpecialCraftTicketOnlyReturn,
  listSpecialCraftTicketReturnFacts,
  listSpecialCraftHandoverFacts,
  listSpecialCraftProcessingCompletionFacts,
  assertSpecialCraftBagCompatibility,
  buildSpecialCraftBagChainKey,
  submitTransferBagScrap,
  type SubmitTransferBagRepackInput,
  type TransferBagHandoverTaskContext,
} from '../../../data/fcs/cutting/transfer-bag-operations.ts'
import {
  listSpreadingResultGeneratedFeiTickets,
  getFeiTicketById,
  type GeneratedFeiTicketSourceRecord,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import { listManualFeiTicketSources } from '../../../data/fcs/cutting/manual-fei-tickets.ts'
import { listCuttingSpecialCraftFeiTicketBindingsForProjection, type CuttingSpecialCraftFeiTicketBinding } from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  buildInboundTempBagInventoryRecords,
  type InboundTempBag,
  type InboundTempBagContainedFeiTicket,
  type InboundTempBagInventoryRecord,
  type TransferBagTicketCandidate,
} from './transfer-bags-model.ts'

export interface WaitHandoverRuntimeOperator {
  operatorId?: string
  operatorName: string
  operatorRole?: string
}

export interface WaitHandoverRuntimeTicketInput {
  ticketKind?: TransferBagTicketFactSnapshot['ticketKind']
  materialKey?: string
  materialCode?: string
  materialName?: string
  materialImageUrl?: string
  quantity?: number
  quantityUnit?: string
  replacementSequence?: number
  feiTicketId: string
  feiTicketNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  spuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  hasSpecialCraft: boolean
  specialCraftChainKey?: string
  specialCraftDisplay: string
  receiverFactoryDisplay: string
  printStatus: string
  voidStatus: string
}

export interface WaitHandoverRuntimeProjection {
  runtimeEvents: CuttingRuntimeEvent[]
  generatedTickets: GeneratedFeiTicketSourceRecord[]
  inboundTempBags: InboundTempBag[]
  inboundInventoryRecords: InboundTempBagInventoryRecord[]
  ticketCandidates: GeneratedFeiTicketSourceRecord[]
  baggingConfirmEvents: CuttingRuntimeEvent[]
  handoverRecordEvents: CuttingRuntimeEvent[]
}

export interface WaitHandoverBaggingSnapshot {
  usageCycleId: string
  productionOrderNo: string
  tickets: WaitHandoverRuntimeTicketInput[]
  sourceBagCode?: string
  sourceUsageCycleId?: string
  confirmedAt?: string
}

export interface WaitHandoverBaggingEventInput {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  tickets: WaitHandoverRuntimeTicketInput[]
  occurredAt?: string
  usageCycleId?: string
  idempotencyKey?: string
  storage?: BrowserStorageLike | null
}

export interface WaitHandoverLocationOccupancyState {
  sourceEventId: string
  bagCode: string
  productionOrderNo: string
  feiTicketIds: string[]
  feiTicketQtyById: Record<string, number>
  totalPieceQty: number
  inboundAt: string
  inboundBy: string
  locationRef: RuntimeWarehouseLocationRef
  warehouseLocations: RuntimeWarehouseLocationRef[]
  objectNo?: string
  objectName?: string
  usageCycleId?: string
}

function compareWaitHandoverRuntimeEvents(left: CuttingRuntimeEvent, right: CuttingRuntimeEvent): number {
  return left.occurredAt.localeCompare(right.occurredAt, 'zh-CN')
    || (left.createdAt || left.occurredAt).localeCompare(right.createdAt || right.occurredAt, 'zh-CN')
    || left.eventId.localeCompare(right.eventId, 'zh-CN')
}

function runtimeTicketQtyById(value: unknown, qtyField: 'pieceQty' | 'returnedQty'): Record<string, number> {
  const rows = Array.isArray(value) ? value : []
  const quantities = new Map<string, number>()
  rows.forEach((rawRow) => {
    const row = runtimeRecord(rawRow)
    const ticketId = runtimeString(row.feiTicketId)
    const qty = Math.max(0, runtimeNumber(row[qtyField]))
    if (ticketId && qty > 0) quantities.set(ticketId, (quantities.get(ticketId) || 0) + qty)
  })
  return Object.fromEntries(quantities)
}

function runtimeTicketIds(value: unknown): string[] {
  return uniqueStrings((Array.isArray(value) ? value : []).map((row) => runtimeString(runtimeRecord(row).feiTicketId)))
}

function sameStringSet(left: Iterable<string>, right: Iterable<string>): boolean {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  return leftSet.size === rightSet.size
    && [...leftSet].every((value) => rightSet.has(value))
}

function adjustRuntimeTicketQtys(
  current: Record<string, number>,
  deltas: Record<string, number>,
  direction: 'OUT' | 'IN',
): Record<string, number> {
  const next = new Map(Object.entries(current))
  Object.entries(deltas).forEach(([ticketId, qty]) => {
    const adjusted = (next.get(ticketId) || 0) + (direction === 'IN' ? qty : -qty)
    if (adjusted > 0) next.set(ticketId, adjusted)
    else next.delete(ticketId)
  })
  return Object.fromEntries(next)
}

export function mergeWaitHandoverWarehouseLocations(
  currentStates: readonly WaitHandoverLocationOccupancyState[],
  returnedLocations: readonly RuntimeWarehouseLocationRef[],
): RuntimeWarehouseLocationRef[] {
  let trustedFootprint: readonly RuntimeWarehouseLocationRef[] | undefined
  for (const state of currentStates) {
    const candidate = state.warehouseLocations
    if (!candidate.length) continue
    trustedFootprint = candidate
    break
  }
  trustedFootprint ??= currentStates.map((state) => state.locationRef)
  const warehouseLocationById = new Map<string, RuntimeWarehouseLocationRef>()
  trustedFootprint.forEach((location) => {
    warehouseLocationById.set(location.locationId, location)
  })
  currentStates.forEach((state) => {
    if (!warehouseLocationById.has(state.locationRef.locationId)) {
      warehouseLocationById.set(state.locationRef.locationId, state.locationRef)
    }
  })
  returnedLocations.forEach((location) => {
    warehouseLocationById.set(location.locationId, location)
  })
  return Array.from(warehouseLocationById.values())
}

function waitHandoverStateKey(bagCode: string, locationRef?: RuntimeWarehouseLocationRef, usageCycleId?: string): string {
  const scope = locationRef
    ? `${locationRef.factoryId}:${locationRef.warehouseId}:${locationRef.warehouseKind}`
    : 'unknown-scope'
  return `${scope}:${usageCycleId || bagCode}:${bagCode}:${locationRef?.locationId || 'unknown-location'}`
}

function findWaitHandoverStateKeys(
  states: Map<string, WaitHandoverLocationOccupancyState>,
  bagCode: string,
  usageCycleId?: string,
  locationRef?: RuntimeWarehouseLocationRef | null,
): string[] {
  return Array.from(states.entries())
    .filter(([, state]) => state.bagCode === bagCode)
    .filter(([, state]) => !usageCycleId || state.usageCycleId === usageCycleId)
    .filter(([, state]) => !locationRef || (
      state.locationRef.factoryId === locationRef.factoryId
      && state.locationRef.warehouseId === locationRef.warehouseId
      && state.locationRef.warehouseKind === locationRef.warehouseKind
    ))
    .map(([key]) => key)
}

function findWaitHandoverStateKey(
  states: Map<string, WaitHandoverLocationOccupancyState>,
  bagCode: string,
  usageCycleId?: string,
  locationRef?: RuntimeWarehouseLocationRef | null,
): string | undefined {
  const candidates = findWaitHandoverStateKeys(states, bagCode, usageCycleId, locationRef)
  return candidates.length === 1 ? candidates[0] : undefined
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim() || '').filter(Boolean)))
}

function compactDate(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 14) || String(Date.now())
}

export function buildWaitHandoverUsageCycleId(
  bagCode: string,
  occurredAt: string,
): string {
  return `cycle:${bagCode}:${compactDate(occurredAt)}`
}

function runtimeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function runtimeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function runtimeNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function runtimeLocationRef(value: unknown): RuntimeWarehouseLocationRef | null {
  const record = runtimeRecord(value)
  const locationId = runtimeString(record.locationId)
  if (!locationId) return null
  return {
    factoryId: runtimeString(record.factoryId),
    warehouseId: runtimeString(record.warehouseId),
    warehouseKind: record.warehouseKind === 'WAIT_PROCESS' ? 'WAIT_PROCESS' : 'WAIT_HANDOVER',
    areaId: runtimeString(record.areaId),
    areaCode: runtimeString(record.areaCode) || undefined,
    areaName: runtimeString(record.areaName),
    shelfId: runtimeString(record.shelfId),
    shelfSequence: runtimeNumber(record.shelfSequence) || undefined,
    shelfNo: runtimeString(record.shelfNo),
    locationId,
    locationNo: runtimeString(record.locationNo),
    locationName: runtimeString(record.locationName) || undefined,
    levelNo: runtimeNumber(record.levelNo) || undefined,
    positionNo: runtimeNumber(record.positionNo) || undefined,
    areaStatus: record.areaStatus === 'STOPPED' ? 'STOPPED' : record.areaStatus === 'AVAILABLE' ? 'AVAILABLE' : undefined,
    shelfStatus: record.shelfStatus === 'STOPPED' ? 'STOPPED' : record.shelfStatus === 'AVAILABLE' ? 'AVAILABLE' : undefined,
    status: record.status === 'STOPPED' ? 'STOPPED' : record.status === 'AVAILABLE' ? 'AVAILABLE' : undefined,
    orderIndex: Number.isSafeInteger(Number(record.orderIndex)) ? Number(record.orderIndex) : undefined,
  }
}

function sameRuntimeLocationRef(
  left: RuntimeWarehouseLocationRef | null | undefined,
  right: RuntimeWarehouseLocationRef | null | undefined,
): boolean {
  return Boolean(
    left
    && right
    && left.factoryId === right.factoryId
    && left.warehouseId === right.warehouseId
    && left.warehouseKind === right.warehouseKind
    && left.areaId === right.areaId
    && left.areaName === right.areaName
    && left.shelfId === right.shelfId
    && left.shelfNo === right.shelfNo
    && left.locationId === right.locationId
    && left.locationNo === right.locationNo
  )
}

function runtimeWarehouseLocations(payload: Record<string, unknown>): RuntimeWarehouseLocationRef[] {
  const rawLocations = Array.isArray(payload.warehouseLocations)
    ? payload.warehouseLocations
    : payload.locationRef ? [payload.locationRef] : []
  const seen = new Set<string>()
  return rawLocations
    .map(runtimeLocationRef)
    .filter((location): location is RuntimeWarehouseLocationRef => Boolean(location))
    .filter((location) => {
      const key = `${location.factoryId}:${location.warehouseId}:${location.warehouseKind}:${location.locationId}`
      if (seen.has(key)) return false
      seen.add(key)
     return true
   })
}

function resolveWaitHandoverStorage(
  storage: BrowserStorageLike | null | undefined,
): BrowserStorageLike | null {
  return storage === undefined ? getBrowserLocalStorage() : storage
}

function findWaitHandoverIdempotentEvent(
  idempotencyKey: string,
  storage: BrowserStorageLike | null,
): CuttingRuntimeEvent | undefined {
  return listCuttingRuntimeEvents(storage).find(
    (event) =>
      event.eventStatus !== '已取消'
      && event.idempotencyKey === idempotencyKey,
  )
}

function assertWaitHandoverActionAllowed(input: {
  bagCode: string
  action: 'BAGGING' | 'INBOUND' | 'HANDOVER' | 'SPECIAL_CRAFT_RETURN' | 'PHYSICAL_RETURN' | 'SCRAP'
  actionLabel: string
  storage: BrowserStorageLike | null
}): TransferBagLifecycleView {
  const lifecycle = buildWaitHandoverLifecycleByBagCode(
    input.bagCode,
    input.storage,
  )
  if (!lifecycle.allowedActions.includes(input.action)) {
    const current = `${lifecycle.mainStatusLabel} / ${lifecycle.flowStageLabel}`
    throw new Error(
      `${input.bagCode} 当前为${current}，不能${input.actionLabel}。`,
    )
  }
  return lifecycle
}

function sortedNonEmpty(values: Array<string | undefined>): string[] {
  return values.map((value) => value?.trim() || '').filter(Boolean).sort()
}

function assertWholeBagHandoverPayload(input: {
  bagCode: string
  payload: HandoverRecordSubmitPayload
  snapshot: WaitHandoverBaggingSnapshot
}): void {
  if (input.payload.transferBagUses.length !== 1) {
    throw new Error('一次交出只能确认一只完整中转袋。')
  }
  const bagUse = input.payload.transferBagUses[0]
  if (!bagUse || bagUse.bagCode !== input.bagCode) {
    throw new Error('交出记录的中转袋与当前整袋快照不一致。')
  }
  if (!input.payload.receiverId || !input.payload.receiverName) {
    throw new Error('整袋交出必须明确接收任务或接收工厂。')
  }

  const snapshotIds = sortedNonEmpty(
    input.snapshot.tickets.map((ticket) => ticket.feiTicketId),
  )
  const bagUseIds = sortedNonEmpty(bagUse.containedFeiTicketIds)
  const payloadIds = sortedNonEmpty(
    input.payload.feiTicketItems.map((ticket) => ticket.feiTicketId),
  )
  const sameIds = (left: string[], right: string[]) =>
    left.length === right.length
    && left.every((value, index) => value === right[index])
  if (
    !snapshotIds.length
    || !sameIds(snapshotIds, bagUseIds)
    || !sameIds(snapshotIds, payloadIds)
  ) {
    throw new Error('交出必须使用当前使用周期的完整中转袋袋内快照。')
  }

  const snapshotQty = input.snapshot.tickets.reduce(
    (sum, ticket) => sum + Number(ticket.pieceQty || 0),
    0,
  )
  const payloadQty = input.payload.feiTicketItems.reduce(
    (sum, ticket) => sum + Number(ticket.pieceQty || 0),
    0,
  )
  if (
    Number(bagUse.totalPieceQty) !== snapshotQty
    || Number(input.payload.currentHandedOverQty) !== snapshotQty
    || payloadQty !== snapshotQty
  ) {
    throw new Error('交出数量必须等于完整中转袋袋内快照数量。')
  }
}

function assertWholeBagSpecialCraftHandoverPayload(input: {
  bagCode: string
  payload: SpecialCraftHandoverPayload
  snapshot: WaitHandoverBaggingSnapshot
  handoverOrderId: string
  handoverRecordId: string
  specialCraftId: string
  occurredAt: string
  operatorName: string
}): void {
  if (
    !input.payload.handoverRecordId
    || !input.payload.receiverFactoryId
    || !input.payload.receiverFactoryName
    || input.payload.handoverOrderId !== input.handoverOrderId
    || input.payload.handoverRecordId !== input.handoverRecordId
  ) {
    throw new Error('特殊工艺整袋交出必须明确来源记录和接收工厂。')
  }
  const snapshotIds = sortedNonEmpty(
    input.snapshot.tickets.map((ticket) => ticket.feiTicketId),
  )
  const payloadIds = sortedNonEmpty(
    Array.from(
      new Set(
        input.payload.feiTicketItems.map((ticket) => ticket.feiTicketId),
      ),
    ),
  )
  if (
    snapshotIds.length !== payloadIds.length
    || snapshotIds.some((value, index) => value !== payloadIds[index])
  ) {
    throw new Error('特殊工艺带袋交出必须包含当前中转袋的完整菲票快照。')
  }
  const payloadQtyByTicket = input.payload.feiTicketItems.reduce<
    Record<string, number>
  >((result, ticket) => {
    result[ticket.feiTicketId] =
      (result[ticket.feiTicketId] || 0) + Number(ticket.pieceQty || 0)
    return result
  }, {})
  if (
    !input.payload.feiTicketItems.some(item => item.specialCraftId === input.specialCraftId)
    || input.snapshot.tickets.some(
      (ticket) =>
        payloadQtyByTicket[ticket.feiTicketId] !== Number(ticket.pieceQty || 0)
        || !input.payload.feiTicketItems.some((item) =>
          item.feiTicketId === ticket.feiTicketId
          && item.feiTicketNo === ticket.feiTicketNo
          && Boolean(item.specialCraftId?.trim())
          && item.partName === ticket.partName
          && item.size === ticket.size),
    )
  ) {
    throw new Error('特殊工艺带袋交出明细必须与完整中转袋袋内快照一致。')
  }
  if (
    input.payload.handedOverAt !== input.occurredAt
    || input.payload.handedOverBy !== input.operatorName
  ) {
    throw new Error('特殊工艺整袋交出的时间和操作人必须与提交事实一致。')
  }
}

function getWaitHandoverEventUsageCycleId(
  event: CuttingRuntimeEvent,
): string {
  return event.refs.usageCycleId
    || runtimeString(runtimeRecord(event.payload).usageCycleId)
}

function isWaitHandoverBagEventForCode(
  event: CuttingRuntimeEvent,
  bagCode: string,
): boolean {
  return event.eventStatus !== '已取消' && eventTouchesTransferBag(event, bagCode)
}

function getWaitHandoverRepackBag(
  event: CuttingRuntimeEvent,
  key: 'sourceBags',
  bagCode: string,
): TransferBagRepackPayload['sourceBags'][number] | undefined
function getWaitHandoverRepackBag(
  event: CuttingRuntimeEvent,
  key: 'resultBags',
  bagCode: string,
): TransferBagRepackPayload['resultBags'][number] | undefined
function getWaitHandoverRepackBag(
  event: CuttingRuntimeEvent,
  key: 'sourceBags' | 'resultBags',
  bagCode: string,
): TransferBagRepackPayload['sourceBags'][number]
  | TransferBagRepackPayload['resultBags'][number]
  | undefined {
  const payload = parseCompleteTransferBagRepackPayload(event)
  return payload?.[key].find((bag) => bag.bagCode === bagCode)
}

function getWaitHandoverBagEventUsageCycleId(
  event: CuttingRuntimeEvent,
  bagCode: string,
): string {
  const resultBag = getWaitHandoverRepackBag(event, 'resultBags', bagCode)
  if (resultBag) return runtimeString(resultBag.usageCycleId)
  const sourceBag = getWaitHandoverRepackBag(event, 'sourceBags', bagCode)
  if (sourceBag) return runtimeString(sourceBag.usageCycleId)
  return getWaitHandoverEventUsageCycleId(event)
}

function sortWaitHandoverEvents(events: readonly CuttingRuntimeEvent[]): CuttingRuntimeEvent[] {
  return [...events].sort(createCuttingRuntimeChronologyComparator(events))
}

function inferWaitHandoverEventCycleIds(
  events: CuttingRuntimeEvent[],
  bagCode: string,
): Map<string, string> {
  const result = new Map<string, string>()
  let currentCycleId = ''
  for (const event of events) {
    if (!isWaitHandoverBagEventForCode(event, bagCode)) continue
    const declaredCycleId = getWaitHandoverBagEventUsageCycleId(event, bagCode)
    if (event.eventType === '菲票装袋') {
      currentCycleId = declaredCycleId
        || buildWaitHandoverUsageCycleId(bagCode, event.occurredAt)
    } else if (event.eventType === '中转袋拆袋重装') {
      const resultBag = getWaitHandoverRepackBag(event, 'resultBags', bagCode)
      const sourceBag = getWaitHandoverRepackBag(event, 'sourceBags', bagCode)
      currentCycleId = resultBag || sourceBag?.outcome === 'RETURN_INBOUND' ? declaredCycleId : ''
    } else if (declaredCycleId) {
      currentCycleId = declaredCycleId
    }
    if (currentCycleId) result.set(event.eventId, currentCycleId)
  }
  return result
}

function toWaitHandoverLifecycleFact(
  event: CuttingRuntimeEvent,
  usageCycleId: string,
  bagCode: string,
  events: CuttingRuntimeEvent[],
): TransferBagLifecycleFact | null {
  if (
    event.eventType === '新增交出记录'
    && !isCompleteSuccessfulWholeBagHandoverEvent(event)
  ) return null
  if (
    event.eventType === '特殊工艺交出'
    && !isCompleteSuccessfulSpecialCraftHandoverEvent(event)
  ) return null
  if (
    event.eventType === '特殊工艺回仓'
    && !isCompleteSuccessfulSpecialCraftBagReturnEvent(event)
  ) return null
  if (
    event.eventType === '中转袋回收'
    && !isEffectiveTransferBagRecoveryEvent(event, events)
  ) return null
  if (
    event.eventType === '中转袋报废'
    && !isEffectiveTransferBagScrapEvent(event, events)
  ) return null
  if (event.eventType === '中转袋拆袋重装') {
    const sourceBag = getWaitHandoverRepackBag(event, 'sourceBags', bagCode)
    const factType = getWaitHandoverRepackBag(event, 'resultBags', bagCode)
      ? 'REPACK_RESULT_CONFIRMED'
      : sourceBag?.outcome === 'RETURN_INBOUND'
        ? 'REPACK_SOURCE_RETAINED'
        : sourceBag
        ? 'REPACK_SOURCE_EMPTIED'
        : null
    return factType
      ? {
          factId: event.eventId,
          factType,
          usageCycleId,
          occurredAt: event.occurredAt,
          ledgerSequence: event.ledgerSequence,
          createdAt: event.createdAt,
        }
      : null
  }
  const factType =
    event.eventType === '菲票装袋'
      ? 'BAGGING_CONFIRMED'
      : event.eventType === '中转袋入仓'
        ? 'INBOUND_CONFIRMED'
        : event.eventType === '新增交出记录'
          || event.eventType === '特殊工艺交出'
          ? 'HANDOVER_CONFIRMED'
          : event.eventType === '特殊工艺回仓'
            ? 'SPECIAL_CRAFT_BAG_RETURNED'
            : event.eventType === '中转袋回收'
              ? 'PHYSICAL_BAG_RETURNED'
              : event.eventType === '中转袋报废'
                ? 'BAG_SCRAPPED'
            : null
  if (!factType) return null
  return {
    factId: event.eventId,
    factType,
    usageCycleId,
    handoverLegId: event.refs.handoverLegId,
    occurredAt: event.occurredAt,
    ledgerSequence: event.ledgerSequence,
    createdAt: event.createdAt,
  }
}

export function listWaitHandoverLifecycleFacts(
  bagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): TransferBagLifecycleFact[] {
  const events = sortWaitHandoverEvents(listCuttingRuntimeEvents(storage).filter(event => event.eventStatus !== '已取消'))
    .filter((event) => isWaitHandoverBagEventForCode(event, bagCode))
  const inferredCycleIds = inferWaitHandoverEventCycleIds(events, bagCode)
  return events
    .flatMap((event) => {
      const usageCycleId =
        getWaitHandoverBagEventUsageCycleId(event, bagCode)
        || inferredCycleIds.get(event.eventId)
        || ''
      return usageCycleId || event.eventType === '中转袋报废'
        ? toWaitHandoverLifecycleFact(event, usageCycleId, bagCode, events)
        : null
    })
    .filter((fact): fact is TransferBagLifecycleFact => Boolean(fact))
}

function listWaitHandoverLifecycleCycles(
  bagCode: string,
  facts: TransferBagLifecycleFact[],
  events: CuttingRuntimeEvent[],
): TransferBagLifecycleCycle[] {
  const compare = createCuttingRuntimeChronologyComparator(events)
  const startFacts = facts.filter((fact) =>
    fact.factType === 'BAGGING_CONFIRMED'
    || fact.factType === 'REPACK_RESULT_CONFIRMED')
  const uniqueStartByCycle = new Map<string | undefined, TransferBagLifecycleFact>()
  for (const fact of startFacts) {
    if (!uniqueStartByCycle.has(fact.usageCycleId)) {
      uniqueStartByCycle.set(fact.usageCycleId, fact)
    }
  }
  const uniqueStarts = Array.from(uniqueStartByCycle.values())
  return uniqueStarts.map((fact) => {
    const closeFact = facts
      .filter((candidate) =>
        candidate.usageCycleId === fact.usageCycleId
        && (
          candidate.factType === 'PHYSICAL_BAG_RETURNED'
          || candidate.factType === 'REPACK_SOURCE_EMPTIED'
        ))
      .at(-1)
    const replacedByRepack = events
      .filter((event) =>
        event.eventType === '中转袋拆袋重装'
        && eventTouchesTransferBag(event, bagCode)
        && getWaitHandoverRepackBag(event, 'sourceBags', bagCode)?.outcome !== 'RETURN_INBOUND'
        && runtimeString(getWaitHandoverRepackBag(event, 'sourceBags', bagCode)?.usageCycleId) === fact.usageCycleId
        && runtimeString(getWaitHandoverRepackBag(event, 'resultBags', bagCode)?.usageCycleId) !== fact.usageCycleId)
      .sort(compare)
      .at(-1)
    const closedAt = closeFact?.occurredAt || replacedByRepack?.occurredAt
    const closedChronology = closeFact
      ? {
          ledgerSequence: closeFact.ledgerSequence,
          createdAt: closeFact.createdAt,
          factId: closeFact.factId,
        }
      : replacedByRepack
        ? {
            ledgerSequence: replacedByRepack.ledgerSequence,
            createdAt: replacedByRepack.createdAt,
            eventId: replacedByRepack.eventId,
          }
        : undefined
    return {
      usageCycleId: fact.usageCycleId || '',
      startedAt: fact.occurredAt,
      startedChronology: {
        ledgerSequence: fact.ledgerSequence,
        createdAt: fact.createdAt,
        factId: fact.factId,
      },
      ...(closedAt
        ? {
            closedAt,
            closedChronology,
            closeResult: 'REUSABLE' as const,
          }
        : {}),
    }
  }).filter((cycle) => cycle.usageCycleId)
}

export function appendWaitHandoverPhysicalReturnEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  usageCycleId: string
  returnedAt?: string
  returnWarehouseName: string
  note?: string
  storage?: BrowserStorageLike | null
}) {
  const storage = resolveWaitHandoverStorage(input.storage)
  return recoverTransferBag({
    bagCode: input.bagCode,
    physicalBagReceived: true,
    physicalBagEmpty: true,
    recoveryMode: 'NORMAL',
    recoveryNode: input.returnWarehouseName,
    recoveryLocation: input.returnWarehouseName,
    reason: input.note || '',
    operator: input.operator,
    source: input.source,
    occurredAt: input.returnedAt,
  }, storage)
}

export function appendWaitHandoverScrapEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  usageCycleId?: string
  scrappedAt?: string
  reason: string
  authorizedBy?: string
  storage?: BrowserStorageLike | null
}) {
  const storage = resolveWaitHandoverStorage(input.storage)
  return submitTransferBagScrap({
    bagCode: input.bagCode,
    reason: input.reason,
    authorizedBy: input.authorizedBy || input.operator.operatorName,
    operator: input.operator,
    source: input.source,
    occurredAt: input.scrappedAt,
  }, storage)
}

function resolveWaitHandoverUsageCycleId(
  bagCode: string,
  occurredAt: string,
  storage: BrowserStorageLike | null,
): string {
  const latestFact = listWaitHandoverLifecycleFacts(bagCode, storage).at(-1)
  return latestFact?.usageCycleId
    || buildWaitHandoverUsageCycleId(bagCode, occurredAt)
}

export function buildWaitHandoverLifecycleByBagCode(
  bagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): TransferBagLifecycleView {
  const facts = listWaitHandoverLifecycleFacts(bagCode, storage)
  const events = sortWaitHandoverEvents(listCuttingRuntimeEvents(storage).filter(event => event.eventStatus !== '已取消'))
    .filter((event) => eventTouchesTransferBag(event, bagCode))
  return deriveTransferBagLifecycle({
    carrierId: bagCode,
    bagCode,
    cycles: listWaitHandoverLifecycleCycles(bagCode, facts, events),
    facts,
  })
}

export function buildNextWaitHandoverHandoverLeg(input: {
  bagCode: string
  usageCycleId: string
  events: CuttingRuntimeEvent[]
}): {
  handoverLegId: string
  handoverSequence: number
} {
  return buildNextTransferBagHandoverLeg(input)
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

function getSpecialCraftDisplay(ticket?: GeneratedFeiTicketSourceRecord): string {
  if (!ticket?.hasSpecialCraft) return '无'
  return ticket.specialCraftDisplayLabel || ticket.specialCrafts.map((craft) => craft.craftName || craft.craftType).filter(Boolean).join('、') || '特殊工艺待维护'
}

function getReceiverFactoryDisplay(ticket?: GeneratedFeiTicketSourceRecord): string {
  if (!ticket?.hasSpecialCraft) return '无'
  return uniqueStrings(ticket.specialCrafts.map((craft) => craft.receiverFactoryName || '承接工厂待补充')).join('、') || '承接工厂待补充'
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

function buildMixedSummary(tickets: InboundTempBagContainedFeiTicket[]): string {
  const productionOrderCount = uniqueStrings(tickets.map((ticket) => ticket.productionOrderNo)).length
  const cutOrderCount = uniqueStrings(tickets.map((ticket) => ticket.cutOrderNo)).length
  const partCount = uniqueStrings(tickets.map((ticket) => ticket.partName)).length
  const sizeCount = uniqueStrings(tickets.map((ticket) => ticket.size)).length
  const specialCraftCount = tickets.filter((ticket) => ticket.hasSpecialCraft).length
  return `涉及生产单 ${productionOrderCount} 个、裁片单 ${cutOrderCount} 张、部位 ${partCount} 个、尺码 ${sizeCount} 个、特殊工艺菲票 ${specialCraftCount} 张`
}

function buildMixedFlag(tickets: WaitHandoverRuntimeTicketInput[]): boolean {
  return (
    uniqueStrings(tickets.map((ticket) => ticket.productionOrderNo)).length > 1 ||
    uniqueStrings(tickets.map((ticket) => ticket.cutOrderNo)).length > 1 ||
    uniqueStrings(tickets.map((ticket) => ticket.partName)).length > 1 ||
    uniqueStrings(tickets.map((ticket) => ticket.size)).length > 1 ||
    uniqueStrings(tickets.map((ticket) => ticket.hasSpecialCraft ? '有特殊工艺' : '无特殊工艺')).length > 1
  )
}

function buildWaitHandoverBagSnapshotItems(
  tickets: WaitHandoverRuntimeTicketInput[],
): FeiTicketBagSnapshotItem[] {
  return tickets.map((ticket) => ({
    ...mixedBagTicketFields(ticket as unknown as Record<string, unknown>),
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    productionOrderId: ticket.productionOrderId,
    productionOrderNo: ticket.productionOrderNo,
    spreadingOrderId: ticket.spreadingOrderId,
    spreadingOrderNo: ticket.spreadingOrderNo,
    cutOrderId: ticket.cutOrderId,
    cutOrderNo: ticket.cutOrderNo,
    spuCode: ticket.spuCode,
    color: ticket.color,
    size: ticket.size,
    partCode: ticket.partCode,
    partName: ticket.partName,
    pieceQty: ticket.pieceQty,
    unit: '片',
    pieceSequenceLabel: ticket.pieceSequenceLabel,
    hasSpecialCraft: ticket.hasSpecialCraft,
    specialCraftCategory:
      ticket.hasSpecialCraft ? ticket.specialCraftDisplay : '无',
    specialCraftDisplay: ticket.specialCraftDisplay,
    receiverFactoryDisplay: ticket.receiverFactoryDisplay,
    printStatus: ticket.printStatus,
    voidStatus: ticket.voidStatus,
  }))
}

function buildWaitHandoverRuntimeTicketFromSnapshotItem(
  item: Record<string, unknown>,
  event: CuttingRuntimeEvent,
): WaitHandoverRuntimeTicketInput {
  const hasSpecialCraft = Boolean(item.hasSpecialCraft)
  return {
    ...mixedBagTicketFields(item),
    feiTicketId: runtimeString(item.feiTicketId),
    feiTicketNo: runtimeString(item.feiTicketNo),
    productionOrderId:
      runtimeString(item.productionOrderId)
      || event.refs.productionOrderId
      || '',
    productionOrderNo:
      runtimeString(item.productionOrderNo)
      || event.refs.productionOrderNo
      || '',
    cutOrderId: typeof item.cutOrderId === 'string' ? runtimeString(item.cutOrderId) : event.refs.cutOrderId || '',
    cutOrderNo: typeof item.cutOrderNo === 'string' ? runtimeString(item.cutOrderNo) : event.refs.cutOrderNo || '',
    spreadingOrderId: typeof item.spreadingOrderId === 'string' ? runtimeString(item.spreadingOrderId) : event.refs.spreadingOrderId || '',
    spreadingOrderNo: typeof item.spreadingOrderNo === 'string' ? runtimeString(item.spreadingOrderNo) : event.refs.spreadingOrderNo || '',
    spuCode: runtimeString(item.spuCode),
    color: runtimeString(item.color),
    size: runtimeString(item.size),
    partCode: runtimeString(item.partCode),
    partName: runtimeString(item.partName),
    pieceQty: runtimeNumber(item.pieceQty),
    pieceSequenceLabel:
      runtimeString(item.pieceSequenceLabel) || '按菲票追踪',
    hasSpecialCraft,
    specialCraftDisplay:
      runtimeString(item.specialCraftDisplay)
      || runtimeString(item.specialCraftCategory)
      || (hasSpecialCraft ? '特殊工艺待维护' : '无'),
    receiverFactoryDisplay:
      runtimeString(item.receiverFactoryDisplay)
      || (hasSpecialCraft ? '承接工厂待补充' : '无'),
    printStatus: runtimeString(item.printStatus) || '已打印',
    voidStatus: runtimeString(item.voidStatus) || '有效',
  }
}

export function resolveWaitHandoverBaggingSnapshot(
  bagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): WaitHandoverBaggingSnapshot | null {
  const currentUse = resolveTransferBagCurrentUse(bagCode, storage)
  if (!currentUse.usageCycleId || !currentUse.tickets.length) return null
  const tickets = currentUse.tickets.map((ticket) =>
    buildWaitHandoverRuntimeTicketFromTransferBagFact(ticket))
  return {
    usageCycleId: currentUse.usageCycleId,
    productionOrderNo: currentUse.productionOrderNo,
    tickets,
  }
}

function buildWaitHandoverRuntimeTicketFromTransferBagFact(
  ticket: TransferBagTicketFactSnapshot,
): WaitHandoverRuntimeTicketInput {
  const compatibility = runtimeRecord(ticket)
  return {
    ...mixedBagTicketFields(compatibility),
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    productionOrderId: ticket.productionOrderId,
    productionOrderNo: ticket.productionOrderNo,
    cutOrderId: ticket.cutOrderId,
    cutOrderNo: ticket.cutOrderNo,
    spreadingOrderId: runtimeString(compatibility.spreadingOrderId),
    spreadingOrderNo: runtimeString(compatibility.spreadingOrderNo),
    spuCode: runtimeString(compatibility.spuCode),
    color: ticket.color,
    size: ticket.size,
    partCode: ticket.partCode,
    partName: ticket.partName,
    pieceQty: ticket.pieceQty,
    pieceSequenceLabel: runtimeString(compatibility.pieceSequenceLabel) || '按菲票追踪',
    hasSpecialCraft: Boolean(compatibility.hasSpecialCraft),
    specialCraftChainKey: runtimeString(compatibility.specialCraftChainKey),
    specialCraftDisplay: runtimeString(compatibility.specialCraftDisplay) || '无',
    receiverFactoryDisplay:
      ticket.receiverFactoryName
      || runtimeString(compatibility.receiverFactoryDisplay)
      || '接收工厂待补充',
    printStatus: runtimeString(compatibility.printStatus) || '已打印',
    voidStatus: runtimeString(compatibility.voidStatus) || '有效',
  }
}

export function buildWaitHandoverRuntimeTicketFromGeneratedTicket(ticket: GeneratedFeiTicketSourceRecord): WaitHandoverRuntimeTicketInput {
  return {
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    productionOrderId: ticket.productionOrderId,
    productionOrderNo: ticket.productionOrderNo,
    cutOrderId: ticket.cutOrderId,
    cutOrderNo: ticket.cutOrderNo,
    spreadingOrderId: ticket.spreadingOrderId || ticket.sourceSpreadingSessionId,
    spreadingOrderNo: ticket.spreadingOrderNo || ticket.sourceSpreadingSessionNo,
    spuCode: ticket.sourceTechPackSpuCode || ticket.skuCode,
    color: ticket.garmentColor || ticket.skuColor || ticket.fabricColor,
    size: ticket.skuSize,
    partCode: ticket.partCode,
    partName: ticket.partName,
    pieceQty: ticket.actualCutPieceQty || ticket.qty || 0,
    pieceSequenceLabel: ticket.pieceSequenceLabel || ticket.pieceSetNoRange || '按菲票追踪',
    hasSpecialCraft: Boolean(ticket.hasSpecialCraft),
    specialCraftChainKey: buildSpecialCraftBagChainKey(ticket),
    specialCraftDisplay: getSpecialCraftDisplay(ticket),
    receiverFactoryDisplay: getReceiverFactoryDisplay(ticket),
    printStatus: getRuntimeTicketPrintStatus(ticket),
    voidStatus: getRuntimeTicketVoidStatus(ticket),
  }
}

export function buildWaitHandoverRuntimeTicketFromTransferCandidate(ticket: TransferBagTicketCandidate): WaitHandoverRuntimeTicketInput {
  return {
    ...mixedBagTicketFields(ticket as unknown as Record<string, unknown>),
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.ticketNo,
    productionOrderId: ticket.productionOrderId,
    productionOrderNo: ticket.productionOrderNo,
    cutOrderId: ticket.cutOrderId,
    cutOrderNo: ticket.cutOrderNo,
    spreadingOrderId: ticket.sourceSpreadingSessionId,
    spreadingOrderNo: ticket.sourceSpreadingSessionNo,
    spuCode: ticket.spuCode,
    color: ticket.color,
    size: ticket.size,
    partCode: ticket.partCode,
    partName: ticket.partName,
    pieceQty: Number(ticket.actualCutPieceQty || ticket.qty || 0),
    pieceSequenceLabel: ticket.pieceSequenceLabel || '按菲票追踪',
    hasSpecialCraft: Boolean(ticket.hasSpecialCraft),
    specialCraftChainKey: runtimeString(runtimeRecord(ticket).specialCraftChainKey),
    specialCraftDisplay: ticket.hasSpecialCraft ? ticket.specialCraftDisplayLabel || '特殊工艺待维护' : '无',
    receiverFactoryDisplay: ticket.hasSpecialCraft ? ticket.receiverFactoryDisplay || '承接工厂待补充' : '无',
    printStatus: ticket.printStatus === 'WAIT_PRINT' ? '待打印' : ticket.printStatus === 'VOIDED' ? '已作废' : '已打印',
    voidStatus: ticket.ticketStatus === 'VOIDED' || ticket.printStatus === 'VOIDED' ? '已作废' : '有效',
  }
}

export function listWaitHandoverRuntimeEvents(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent[] {
  const types = new Set(['菲票装袋', '中转袋入仓', '中转袋拆袋重装', '交出装袋确认', '新增交出记录', '特殊工艺交出', '特殊工艺回仓', '中转袋回收', '中转袋报废'])
  const events = listCuttingRuntimeEvents(storage).filter(event => event.inventoryEffect?.inventoryScope === '裁床待交出仓' || types.has(event.eventType))
  const seen = new Set<string>()
  const uniqueEvents = events
    .filter((event) => {
      if (!event.eventId || seen.has(event.eventId)) return false
      if (event.eventType === '中转袋拆袋重装' && !parseCompleteTransferBagRepackPayload(event)) {
        return false
      }
      seen.add(event.eventId)
      return true
    })
  return sortWaitHandoverEvents(uniqueEvents).reverse()
}

export function buildRuntimeInboundTempBagsFromWaitHandoverEvents(
  runtimeEvents: CuttingRuntimeEvent[],
  generatedTickets: GeneratedFeiTicketSourceRecord[],
): InboundTempBag[] {
  return runtimeEvents
    .filter((event) => event.eventType === '中转袋入仓')
    .map((event) => {
      const payload = runtimeRecord(event.payload)
      const rawItems = Array.isArray(payload.feiTicketItems) ? payload.feiTicketItems : []
      const containedFeiTickets = rawItems.map((rawItem) => {
        const item = runtimeRecord(rawItem)
        const feiTicketId = runtimeString(item.feiTicketId)
        const feiTicketNo = runtimeString(item.feiTicketNo)
        const ticket = findGeneratedFeiTicket(generatedTickets, feiTicketId, feiTicketNo)
        return {
          feiTicketId: feiTicketId || ticket?.feiTicketId || event.refs.feiTicketIds?.[0] || '',
          feiTicketNo: feiTicketNo || ticket?.feiTicketNo || event.refs.feiTicketNos?.[0] || '',
          productionOrderId: ticket?.productionOrderId || event.refs.productionOrderId || '',
          productionOrderNo: ticket?.productionOrderNo || event.refs.productionOrderNo || '按菲票事件追踪',
          cutOrderId: typeof item.cutOrderId === 'string' ? runtimeString(item.cutOrderId) : ticket?.cutOrderId ?? event.refs.cutOrderId ?? '',
          cutOrderNo: typeof item.cutOrderNo === 'string' ? runtimeString(item.cutOrderNo) : ticket?.cutOrderNo ?? event.refs.cutOrderNo ?? '按菲票事件追踪',
          spreadingOrderNo: typeof item.spreadingOrderNo === 'string' ? runtimeString(item.spreadingOrderNo) : ticket?.spreadingOrderNo ?? event.refs.spreadingOrderNo ?? '',
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
      return {
        tempBagUseId: runtimeString(payload.tempBagUseId) || event.eventId,
        usageCycleId: event.refs.usageCycleId || event.eventId,
        hasInboundRecord: true,
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
        inboundSource: '中转袋入仓',
        containedFeiTickets,
        totalPieceQty: runtimeNumber(payload.totalPieceQty) || containedFeiTickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0),
        mixedFlag: typeof payload.mixedFlag === 'boolean'
          ? payload.mixedFlag
          : (
              uniqueStrings(containedFeiTickets.map((ticket) => ticket.productionOrderNo)).length > 1 ||
              uniqueStrings(containedFeiTickets.map((ticket) => ticket.cutOrderNo)).length > 1 ||
              uniqueStrings(containedFeiTickets.map((ticket) => ticket.partName)).length > 1 ||
              uniqueStrings(containedFeiTickets.map((ticket) => ticket.size)).length > 1 ||
              uniqueStrings(containedFeiTickets.map((ticket) => ticket.hasSpecialCraft ? '有特殊工艺' : '无特殊工艺')).length > 1
            ),
        mixedSummary: buildMixedSummary(containedFeiTickets),
        discrepancyRecords: [],
        nextSortingStatus: '未绑定车缝任务，待后续分配后再交出装袋确认',
        remark: `菲票入仓 / ${event.eventStatus}`,
      } satisfies InboundTempBag
    })
}

export function buildWaitHandoverLocationOccupancyStates(
  runtimeEvents: CuttingRuntimeEvent[],
): WaitHandoverLocationOccupancyState[] {
  const states = new Map<string, WaitHandoverLocationOccupancyState>()
  const events = sortWaitHandoverEvents(runtimeEvents.filter((event) => event.eventStatus !== '已取消'))
  const eventById = new Map(events.map(event => [event.eventId, event]))
  const compareEvents = createCuttingRuntimeChronologyComparator(events)

  for (const event of events) {
    const payload = runtimeRecord(event.payload)
      if (event.eventType === '中转袋入仓') {
        const bagCode = runtimeString(payload.bagCode) || event.refs.transferBagCode || ''
      const warehouseLocations = runtimeWarehouseLocations(payload)
      const feiTicketQtyById = runtimeTicketQtyById(payload.feiTicketItems, 'pieceQty')
      if (!bagCode || !warehouseLocations.length) continue
      warehouseLocations.forEach((locationRef) => {
        states.set(waitHandoverStateKey(bagCode, locationRef, runtimeString(payload.usageCycleId) || event.refs.usageCycleId), {
          sourceEventId: event.eventId,
          bagCode,
          productionOrderNo: event.refs.productionOrderNo || '',
          feiTicketIds: [...(event.refs.feiTicketIds ?? [])],
          feiTicketQtyById,
          totalPieceQty: runtimeNumber(payload.totalPieceQty) || Number(event.inventoryEffect?.qty || 0),
          inboundAt: runtimeString(payload.inboundAt) || event.occurredAt,
          inboundBy: runtimeString(payload.inboundBy) || event.operatorName,
          locationRef,
          warehouseLocations,
           usageCycleId: runtimeString(payload.usageCycleId) || event.refs.usageCycleId,
         })
      })
      continue
    }
    if (event.eventType === '中转袋拆袋重装') {
      const repack = parseCompleteTransferBagRepackPayload(event)
      if (!repack) continue
      for (const sourceBag of repack.sourceBags) {
        const stateKey = findWaitHandoverStateKey(
          states,
          sourceBag.bagCode,
          sourceBag.usageCycleId,
        )
        if (stateKey) states.delete(stateKey)
      }
      continue
    }
    if (event.eventType === '交出装袋确认') {
      const sourceBagCode = runtimeString(payload.sourceTempBagCode)
      const targetBagCode = runtimeString(payload.targetTransferBagCode) || event.refs.transferBagCode || ''
      const eventLocationRef = runtimeLocationRef(payload.locationRef)
      const confirmedTicketIds = new Set(event.refs.feiTicketIds ?? [])
      const declaredSourceCycleId = runtimeString(payload.sourceUsageCycleId)
      const matchingSourceKeys = sourceBagCode && confirmedTicketIds.size
        ? findWaitHandoverStateKeys(states, sourceBagCode, undefined, eventLocationRef)
          .filter((stateKey) => {
            const source = states.get(stateKey)
            return source
              && Boolean(eventById.get(source.sourceEventId))
              && compareEvents(eventById.get(source.sourceEventId)!, event) <= 0
              && sameStringSet(source.feiTicketIds, confirmedTicketIds)
              && (!declaredSourceCycleId || source.usageCycleId === declaredSourceCycleId)
          })
        : []
      const latestSource = matchingSourceKeys
        .map((stateKey) => states.get(stateKey))
        .filter((state): state is WaitHandoverLocationOccupancyState => Boolean(state))
        .sort((left, right) =>
          compareEvents(eventById.get(right.sourceEventId)!, eventById.get(left.sourceEventId)!)
          || right.sourceEventId.localeCompare(left.sourceEventId))[0]
      const sourceKeys = latestSource
        ? matchingSourceKeys.filter((stateKey) => states.get(stateKey)?.usageCycleId === latestSource.usageCycleId)
        : []
      if (!sourceKeys.length || !targetBagCode) continue
      sourceKeys.forEach((sourceKey) => {
        const source = states.get(sourceKey)
        if (!source) return
        states.delete(sourceKey)
        states.set(waitHandoverStateKey(targetBagCode, source.locationRef, event.refs.usageCycleId || source.usageCycleId), {
          ...source,
          sourceEventId: event.eventId,
          bagCode: targetBagCode,
          usageCycleId: event.refs.usageCycleId || source.usageCycleId,
          feiTicketIds: event.refs.feiTicketIds?.length ? [...event.refs.feiTicketIds] : source.feiTicketIds,
          feiTicketQtyById: source.feiTicketQtyById,
          totalPieceQty: Number(event.inventoryEffect?.qty || source.totalPieceQty),
        })
      })
      continue
    }
      if (event.eventType === '新增交出记录') {
      if (!isCompleteSuccessfulWholeBagHandoverEvent(event)) continue
        const bagCode = event.refs.transferBagCode || runtimeString(payload.transferBagCode)
      if (bagCode) {
        findWaitHandoverStateKeys(states, bagCode, event.refs.usageCycleId)
          .forEach((stateKey) => states.delete(stateKey))
      }
      continue
    }
      if (event.eventType === '特殊工艺交出') {
      if (!isCompleteSuccessfulSpecialCraftHandoverEvent(event)) continue
      const bagCode = event.refs.transferBagCode || runtimeString(payload.transferBagCode)
      const stateKeys = bagCode ? findWaitHandoverStateKeys(states, bagCode, event.refs.usageCycleId, runtimeWarehouseLocations(payload)[0]) : []
       const current = stateKeys.length ? states.get(stateKeys[0]) : undefined
        if (!bagCode || !current) continue
      const handedOverQty = Number(event.inventoryEffect?.qty || runtimeNumber(payload.handoverQty))
      const ticketDeltas = runtimeTicketQtyById(payload.feiTicketItems, 'pieceQty')
      const nextTicketQtyById = adjustRuntimeTicketQtys(current.feiTicketQtyById, ticketDeltas, 'OUT')
      const explicitRemainingQty = Object.values(nextTicketQtyById).reduce((sum, qty) => sum + qty, 0)
      const remainingQty = Object.keys(ticketDeltas).length
        ? explicitRemainingQty
        : Math.max(0, current.totalPieceQty - handedOverQty)
      if (remainingQty <= 0) {
        stateKeys.forEach((stateKey) => states.delete(stateKey))
      } else {
        stateKeys.forEach((stateKey) => {
          const state = states.get(stateKey)
          if (!state) return
          states.set(stateKey, {
            ...state,
            sourceEventId: event.eventId,
            feiTicketIds: state.feiTicketIds.filter((ticketId) => Number(nextTicketQtyById[ticketId] || 0) > 0),
            totalPieceQty: remainingQty,
            feiTicketQtyById: nextTicketQtyById,
          })
         })
       }
      continue
    }
      if (event.eventType === '特殊工艺回仓') {
      if (!isCompleteSuccessfulSpecialCraftBagReturnEvent(event)) continue
      if (payload.correctionOfEventId && payload.inventoryAdjusted === false) continue
        const returnRecordId = runtimeString(payload.returnRecordId) || event.eventId
      const bagCode = runtimeString(payload.transferBagCode) || event.refs.transferBagCode || ''
      if (!bagCode) continue
      const returnedLocations = runtimeWarehouseLocations(payload)
      const returnedScope = returnedLocations[0]
        ? `${returnedLocations[0].factoryId}:${returnedLocations[0].warehouseId}:${returnedLocations[0].warehouseKind}`
        : ''
      if (returnedScope && returnedLocations.some((location) =>
        `${location.factoryId}:${location.warehouseId}:${location.warehouseKind}` !== returnedScope)) continue
      const candidateStateKeys = findWaitHandoverStateKeys(states, bagCode, event.refs.usageCycleId)
      const candidateScopes = new Set(candidateStateKeys
        .map((stateKey) => states.get(stateKey))
        .filter((state): state is WaitHandoverLocationOccupancyState => Boolean(state))
        .map((state) => `${state.locationRef.factoryId}:${state.locationRef.warehouseId}:${state.locationRef.warehouseKind}`))
      if (!returnedLocations.length && candidateScopes.size !== 1) continue
      const stateKeys = returnedLocations.length
        ? findWaitHandoverStateKeys(states, bagCode, event.refs.usageCycleId, returnedLocations[0])
        : candidateStateKeys
      const currentStates = stateKeys
        .map((stateKey) => states.get(stateKey))
        .filter((state): state is WaitHandoverLocationOccupancyState => Boolean(state))
      const current = currentStates[0]
      const warehouseLocations = mergeWaitHandoverWarehouseLocations(currentStates, returnedLocations)
      if (!warehouseLocations.length) continue
      const returnedQty = Number(event.inventoryEffect?.qty || 0)
      const returnedTicketQtyById = runtimeTicketQtyById(payload.returnedFeiTicketItems, 'returnedQty')
      const currentTicketQtyById = current?.feiTicketQtyById || {}
      const nextTicketQtyById = payload.correctionOfEventId
        ? { ...currentTicketQtyById, ...Object.fromEntries((payload.returnedFeiTicketItems as SpecialCraftReturnPayload['returnedFeiTicketItems']).map(item => [item.feiTicketId, item.returnedQty])) }
        : adjustRuntimeTicketQtys(currentTicketQtyById, returnedTicketQtyById, 'IN')
      const explicitNextQty = Object.values(nextTicketQtyById).reduce((sum, qty) => sum + qty, 0)
      const nextQty = Object.keys(returnedTicketQtyById).length
        ? explicitNextQty
        : Number(current?.totalPieceQty || 0) + returnedQty
      const returnedTicketIds = runtimeTicketIds(payload.returnedFeiTicketItems)
      const appendedTicketIds = returnedTicketIds.length ? returnedTicketIds : event.refs.feiTicketIds ?? []
      const nextTicketIds = uniqueStrings([
        ...currentStates.flatMap((state) => state.feiTicketIds),
        ...appendedTicketIds,
      ]).filter((ticketId) => Number(nextTicketQtyById[ticketId] || 0) > 0)
      const ticketSnapshot = Array.isArray(payload.ticketSnapshot) ? payload.ticketSnapshot.map(runtimeRecord) : []
      const productionOrderByTicketId = new Map(ticketSnapshot.map(ticket => [runtimeString(ticket.feiTicketId), runtimeString(ticket.productionOrderNo)]))
      const currentProductionOrders = nextTicketIds.map(ticketId => productionOrderByTicketId.get(ticketId) || '')
      const productionOrderNo = ticketSnapshot.length
        ? currentProductionOrders.every(Boolean) ? uniqueStrings(currentProductionOrders).join(' / ') : ''
        : event.refs.productionOrderNo || current?.productionOrderNo || ''
      const usageCycleId = event.refs.usageCycleId || current?.usageCycleId
      stateKeys.forEach((stateKey) => states.delete(stateKey))
      warehouseLocations.forEach((locationRef) => {
        states.set(waitHandoverStateKey(bagCode, locationRef, usageCycleId), {
          sourceEventId: event.eventId,
          bagCode,
          productionOrderNo,
          feiTicketIds: nextTicketIds,
          feiTicketQtyById: nextTicketQtyById,
          totalPieceQty: nextQty,
          inboundAt: runtimeString(payload.returnedAt) || event.occurredAt,
          inboundBy: runtimeString(payload.returnedBy) || event.operatorName,
          locationRef,
          warehouseLocations,
          usageCycleId,
          objectNo: runtimeString(payload.transferBagCode) || runtimeString(payload.returnRecordNo) || returnRecordId,
          objectName: runtimeString(payload.transferBagCode)
            ? `中转袋 ${runtimeString(payload.transferBagCode)}`
            : `特殊工艺回仓 ${runtimeString(payload.returnRecordNo) || returnRecordId}`,
        })
      })
      continue
    }
    if (event.eventType === '中转袋回收' || event.eventType === '中转袋报废') {
      const bagCode = event.refs.transferBagCode
        || runtimeString(payload.bagCode)
        || runtimeString(payload.transferBagCode)
      const stateKey = bagCode
        ? findWaitHandoverStateKey(states, bagCode, event.refs.usageCycleId)
        : undefined
      if (stateKey) states.delete(stateKey)
    }
  }
  return Array.from(states.values())
}

function resolveActiveWaitHandoverLocationRef(
  bagCode: string,
  usageCycleId: string,
  storage: BrowserStorageLike | null,
): RuntimeWarehouseLocationRef | null | undefined {
  const candidates = buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
    .filter((state) => state.bagCode === bagCode && state.usageCycleId === usageCycleId)
  if (!candidates.length) return undefined
  const scopes = new Set(candidates.map((state) => `${state.locationRef.factoryId}:${state.locationRef.warehouseId}:${state.locationRef.warehouseKind}`))
  return scopes.size === 1 ? candidates[0].locationRef : null
}

function resolveActiveWaitHandoverLocations(
  bagCode: string,
  usageCycleId: string,
  storage: BrowserStorageLike | null,
): RuntimeWarehouseLocationRef[] {
  const candidates = buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
    .filter((state) => state.bagCode === bagCode && state.usageCycleId === usageCycleId)
  return candidates.length ? candidates[0].warehouseLocations : []
}

function resolveActiveWaitHandoverSourceInventory(
  bagCode: string,
  usageCycleId: string,
  storage: BrowserStorageLike | null,
): {
  sourceEventId: string
  warehouseArea: string
  locationCode: string
  locationRef?: RuntimeWarehouseLocationRef
} | null {
  const source = resolveTransferBagAuthoritativeCurrentLocation({
    bagCode,
    usageCycleId,
    events: listCuttingRuntimeEvents(storage),
  })
  if (source) {
    return {
      sourceEventId: source.sourceEventId,
      warehouseArea: source.warehouseArea,
      locationCode: source.locationCode,
      ...(source.locationRef ? { locationRef: source.locationRef } : {}),
    }
  }
  return null
}

export function buildWaitHandoverRuntimeProjection(
  generatedTickets = [...listSpreadingResultGeneratedFeiTickets(), ...listWoolPanelCuttingReceiptSources()],
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): WaitHandoverRuntimeProjection {
  const runtimeEvents = listWaitHandoverRuntimeEvents(storage)
  const inboundTempBags = buildRuntimeInboundTempBagsFromWaitHandoverEvents(runtimeEvents, generatedTickets)
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
  const bagCodes = uniqueStrings(runtimeEvents.flatMap((event) => [
    event.refs.transferBagCode,
    ...(event.refs.transferBagCodes || []),
    runtimeString(runtimeRecord(event.payload).bagCode),
    runtimeString(runtimeRecord(event.payload).transferBagCode),
    runtimeString(runtimeRecord(event.payload).sourceTempBagCode),
    runtimeString(runtimeRecord(event.payload).targetTransferBagCode),
  ]))
  const currentTicketIds = new Set(
    [...resolveTransferBagCurrentUsesFromEvents(bagCodes, runtimeEvents).values()]
      .flatMap(current => current.tickets.map(ticket => ticket.feiTicketId)),
  )
  return {
    runtimeEvents,
    generatedTickets,
    inboundTempBags,
    inboundInventoryRecords,
    ticketCandidates: generatedTickets.filter((ticket) => !currentTicketIds.has(ticket.feiTicketId) && !isFeiTicketSimplyHandedOver(ticket.feiTicketId, ticket.feiTicketNo)),
    baggingConfirmEvents: runtimeEvents.filter((event) => event.eventType === '交出装袋确认'),
    handoverRecordEvents: runtimeEvents.filter((event) => event.eventType === '新增交出记录'),
  }
}

/** 原票和回仓都是历史事实；库存只取当前在用袋，逐票实收不会追加成第二份库存。 */
export function buildCurrentWaitHandoverInventoryRecords(
  sourceRecords: readonly InboundTempBagInventoryRecord[],
  events: readonly CuttingRuntimeEvent[],
  details: readonly ReleaseTicketDetail[],
  currentUses = resolveTransferBagCurrentUsesFromEvents(uniqueStrings(events.flatMap(event => [
    event.refs.transferBagCode, ...(event.refs.transferBagCodes || []),
  ])), events),
): InboundTempBagInventoryRecord[] {
  const sourcesByTicket = new Map<string, InboundTempBagInventoryRecord>()
  for (const row of sourceRecords) if (!sourcesByTicket.has(row.feiTicketId)) sourcesByTicket.set(row.feiTicketId, row)
  const detailsByTicket = new Map(details.map(detail => [detail.ticketId, detail]))
  const handoversByEvent = new Map(listSpecialCraftHandoverFacts(events).map(fact => [fact.event.eventId, fact]))
  const locations = buildWaitHandoverLocationOccupancyStates([...events])
  const seen = new Set<string>(), rows: InboundTempBagInventoryRecord[] = []
  const eventById = new Map(events.map(event => [event.eventId, event]))
  const compare = createCuttingRuntimeChronologyComparator(events)
  const consumedByTicket = new Map<string, CuttingRuntimeEvent>()
  const consume = (id: string, event: CuttingRuntimeEvent) => {
    const previous = consumedByTicket.get(id)
    if (id && (!previous || compare(event, previous) > 0)) consumedByTicket.set(id, event)
  }
  // 独立实收一旦重新装袋或实际交出，就不再占用原回仓库位。
  for (const event of events) {
    if (!['已记录', '已同步'].includes(event.eventStatus)) continue
    const payload = runtimeRecord(event.payload)
    if (handoversByEvent.has(event.eventId) || isCompleteSuccessfulWholeBagHandoverEvent(event)) {
      for (const ticket of Array.isArray(payload.ticketSnapshot) ? payload.ticketSnapshot.map(runtimeRecord) : []) consume(runtimeString(ticket.feiTicketId), event)
    } else if (['菲票装袋', '中转袋入仓'].includes(event.eventType)
      && (event.refs.transferBagCode || runtimeString(payload.bagCode)) && (event.refs.usageCycleId || runtimeString(payload.usageCycleId))) {
      for (const ticket of Array.isArray(payload.feiTicketItems) ? payload.feiTicketItems.map(runtimeRecord) : []) consume(runtimeString(ticket.feiTicketId), event)
    } else if (event.eventType === '中转袋拆袋重装') {
      const repack = parseCompleteTransferBagRepackPayload(event)
      for (const bag of repack?.sourceBags || []) for (const ticket of bag.beforeTickets) consume(ticket.feiTicketId, event)
    } else if (event.eventType === '简易裁片交出' && payload.schemaVersion === 1 && payload.receiptStatus === 'RECEIVED'
      && runtimeString(payload.assignmentId) && runtimeString(payload.handoverRecordId)) {
      for (const ticket of Array.isArray(payload.tickets) ? payload.tickets.map(runtimeRecord) : []) consume(runtimeString(ticket.feiTicketId), event)
    }
  }
  const latestReceiptByTicket = new Map<string, ReturnType<typeof listSpecialCraftTicketReturnFacts>[number]>()
  for (const receipt of listSpecialCraftTicketReturnFacts(events)) {
    // 已被消费的旧阶段更正只更新历史依据，不遮蔽后道当前实收。
    if (runtimeRecord(eventById.get(receipt.eventId)!.payload).inventoryAdjusted === false) continue
    const previous = latestReceiptByTicket.get(receipt.feiTicketId)
    if (!previous || compare(eventById.get(receipt.eventId)!, eventById.get(previous.eventId)!) > 0) latestReceiptByTicket.set(receipt.feiTicketId, receipt)
  }
  const completed = (detail: ReleaseTicketDetail | undefined) => Boolean(detail?.craftRequirementKnown && detail.completionEvidenceKnown
    && detail.craftSteps.length && detail.craftSteps.at(-1)?.returnedQty !== null
    && detail.craftSteps.every(step => ['已实际回仓', '已交下一工艺', '加工完成待回仓'].includes(step.status)))
  const usable = (id: string, original: InboundTempBagInventoryRecord, detail: ReleaseTicketDetail | undefined) =>
    isCutPieceTicketUsable(id) && detail?.validity !== '不可用' && original.voidStatus !== '已作废'
  const currentOwnerByTicket = new Map<string, string>()
  for (const current of currentUses.values()) if (current.mainStatus === 'IN_USE') for (const ticket of current.tickets) currentOwnerByTicket.set(ticket.feiTicketId, current.bagCode)
  for (const [id, receipt] of latestReceiptByTicket) {
    const event = eventById.get(receipt.eventId)!, payload = runtimeRecord(event.payload)
    if (event.refs.transferBagCode || runtimeString(payload.transferBagCode)) continue
    const consumed = consumedByTicket.get(id)
    const sourceEvent = eventById.get(receipt.sourceHandoverEventId)!
    // 更正时间可能晚于实交时间；是否被消费仍以原来源交出后的动作判断。
    if (currentOwnerByTicket.has(id) || consumed && compare(consumed, sourceEvent) > 0 || payload.inventoryAdjusted === false) continue
    const original = sourcesByTicket.get(id), detail = detailsByTicket.get(id)
    if (!original || original.feiTicketNo !== receipt.feiTicketNo) continue
    const valid = usable(id, original, detail)
    seen.add(id)
    rows.push({ ...original, inventoryRecordId: `INV-${receipt.eventId}-${id}`, pieceQty: valid ? receipt.returnedQty : 0,
      tempBagCode: '—', warehouseArea: receipt.locationRef.areaName, locationCode: receipt.locationRef.locationNo,
      inboundAt: receipt.returnedAt, hasSpecialCraft: true, specialCraftDisplay: completed(detail) ? '已回仓' : '未做特殊工艺',
      receiverFactoryDisplay: handoversByEvent.get(receipt.sourceHandoverEventId)?.payload.receiverFactoryName || original.receiverFactoryDisplay,
      inventoryStatus: !valid ? '已作废或不可用' : !detail?.craftRequirementKnown || detail.physicalPieceQty !== receipt.returnedQty ? '待核对' : '待分配',
    })
  }
  for (const current of currentUses.values()) {
    if (current.mainStatus !== 'IN_USE' || !current.usageCycleId || current.flowStage === 'PACKED') continue
    const source = handoversByEvent.get(current.latestHandoverEventId)
    const inWarehouse = ['INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage || '')
    const stock = new Map(current.tickets.map(ticket => [ticket.feiTicketId, ticket]))
    // 零量点收保留该票的一行，但不借用原票数量。
    const tickets = source?.usageCycleId === current.usageCycleId ? source.payload.ticketSnapshot : current.tickets
    const location = inWarehouse ? locations.find(row => row.bagCode === current.bagCode && row.usageCycleId === current.usageCycleId) : undefined
    for (const ticket of tickets) {
      if (seen.has(ticket.feiTicketId) || ['REPLACEMENT_FABRIC', 'BINDING_STRIP'].includes(ticket.ticketKind || '')) continue
      const owner = currentOwnerByTicket.get(ticket.feiTicketId)
      if (owner && owner !== current.bagCode) continue
      const receipt = latestReceiptByTicket.get(ticket.feiTicketId), receiptEvent = receipt && eventById.get(receipt.eventId)
      if (!owner && receiptEvent && !receiptEvent.refs.transferBagCode && !runtimeString(runtimeRecord(receiptEvent.payload).transferBagCode) && source && compare(receiptEvent, source.event) > 0) continue
      const original = sourcesByTicket.get(ticket.feiTicketId)
      if (!original || original.feiTicketNo !== ticket.feiTicketNo) continue
      seen.add(ticket.feiTicketId)
      const detail = detailsByTicket.get(ticket.feiTicketId)
      const valid = usable(ticket.feiTicketId, original, detail)
      const actualQty = stock.get(ticket.feiTicketId)?.pieceQty ?? 0
      const pieceQty = valid && inWarehouse && location && Number.isSafeInteger(actualQty) && actualQty >= 0 ? actualQty : 0
      const requiresCraft = Boolean(detail?.requiresSpecialCraft || original.hasSpecialCraft || source)
      // 尚未分配车缝任务是下游待办；原共用交出校验允许分配后补齐，不是裁片来源冲突。
      const assignmentPending = current.compatibilityBlockedReason === '历史袋内快照缺少接收工厂事实，当前关系仅供核查，不能拆袋重装。'
        || current.compatibilityBlockedReason === '历史袋内快照缺少车缝任务事实，当前关系仅供核查，不能拆袋重装。'
      const blocked = Boolean(current.compatibilityBlockedReason && !assignmentPending || !detail?.craftRequirementKnown || detail.physicalPieceQty !== pieceQty)
      rows.push({ ...original,
        inventoryRecordId: original.tempBagCode === current.bagCode ? original.inventoryRecordId : `INV-${current.usageCycleId}-${ticket.feiTicketId}`,
        pieceQty, tempBagCode: current.bagCode,
        warehouseArea: location?.locationRef.areaName || '—', locationCode: location?.locationRef.locationNo || '—',
        inboundAt: location?.inboundAt || original.inboundAt,
        hasSpecialCraft: requiresCraft,
        specialCraftDisplay: requiresCraft ? !inWarehouse ? '特殊工艺加工中' : completed(detail) ? '已回仓' : '未做特殊工艺' : '无特殊工艺',
        receiverFactoryDisplay: source?.payload.receiverFactoryName || original.receiverFactoryDisplay,
        inventoryStatus: !valid ? '已作废或不可用' : !inWarehouse ? '已交出' : blocked ? '待核对' : '待分配',
      })
    }
  }
  return rows
}

export function runtimeEventHasWaitHandoverTicket(eventType: string, feiTicketId: string, specialCraftId?: string): boolean {
  return listCuttingRuntimeEvents().some((event) => {
    if (event.eventType !== eventType || event.eventStatus === '已取消') return false
    if (!event.refs.feiTicketIds?.includes(feiTicketId)) return false
    if (specialCraftId && ![runtimeRecord(event.payload).feiTicketItems, runtimeRecord(event.payload).returnedFeiTicketItems].flatMap(items => Array.isArray(items) ? items.map(runtimeRecord) : []).some(item => item.feiTicketId === feiTicketId && item.specialCraftId === specialCraftId)) return false
    return true
  })
}

export function appendWaitHandoverBaggingEvent(input: WaitHandoverBaggingEventInput) {
  const storage = resolveWaitHandoverStorage(input.storage)
  if (!input.bagCode.trim()) {
    throw new Error('请扫描或输入中转袋编号。')
  }
  const occurredAt = input.occurredAt || new Date().toISOString()
  const usageCycleId =
    input.usageCycleId
    || buildWaitHandoverUsageCycleId(input.bagCode, occurredAt)
  const tickets = input.tickets
  if (!tickets.length) {
    throw new Error('请至少选择或扫描一张有效菲票。')
  }
  const unusable = tickets.find(ticket => !isCutPieceTicketUsable(ticket.feiTicketId))
  if (unusable) throw new Error(`${unusable.feiTicketNo} 已登记整票不可用，不能装袋或继续交出。`)
  const voidedTicketNos = tickets
    .filter((ticket) => runtimeString(ticket.voidStatus).includes('作废') || runtimeString(ticket.printStatus).includes('作废'))
    .map((ticket) => ticket.feiTicketNo || ticket.feiTicketId)
  if (voidedTicketNos.length) {
    throw new Error(`以下菲票已作废，不能装袋：${uniqueStrings(voidedTicketNos).join('、')}`)
  }
  const productionOrderNos = uniqueStrings(
    tickets.map((ticket) => ticket.productionOrderNo),
  )
  if (productionOrderNos.length !== 1) {
    throw new Error('同一中转袋只能装入同一生产单的菲票')
  }
  assertSpecialCraftBagCompatibility(tickets.map(ticket => {
    const generated = getFeiTicketById(ticket.feiTicketId) || listManualFeiTicketSources().find(source => source.feiTicketId === ticket.feiTicketId)
    const specialCraftChainKey = ticket.specialCraftChainKey || (generated ? buildSpecialCraftBagChainKey(generated) : '')
    return { ...ticket, specialCraftChainKey }
  }))
  const idempotencyKey =
    input.idempotencyKey
    || `${usageCycleId}:BAGGING_CONFIRMED`
  const existing = findWaitHandoverIdempotentEvent(
    idempotencyKey,
    storage,
  )
  if (existing) return existing
  assertWaitHandoverActionAllowed({
    bagCode: input.bagCode,
    action: 'BAGGING',
    actionLabel: '重复装袋',
    storage,
  })
  const totalPieceQty = tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
  const first = tickets[0]
  const payload: FeiTicketBaggingPayload = {
    baggingRecordId: `bagging:${input.bagCode}:${compactDate(occurredAt)}`,
    bagCode: input.bagCode,
    feiTicketItems: buildWaitHandoverBagSnapshotItems(tickets),
    totalPieceQty,
    mixedFlag: buildMixedFlag(tickets),
    baggingBy: input.operator.operatorName,
    baggingAt: occurredAt,
  }
  return appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '菲票装袋',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '裁片仓装袋员',
    refs: {
      productionOrderId: first?.productionOrderId || '',
      productionOrderNo: first?.productionOrderNo || '',
      cutOrderId: first?.cutOrderId || '',
      cutOrderNo: first?.cutOrderNo || '',
      spreadingOrderId: first?.spreadingOrderId || '',
      spreadingOrderNo: first?.spreadingOrderNo || '',
      feiTicketIds: tickets.map((ticket) => ticket.feiTicketId).filter(Boolean),
      feiTicketNos: tickets.map((ticket) => ticket.feiTicketNo).filter(Boolean),
      transferBagCode: input.bagCode,
      usageCycleId,
    },
    payload,
  }, storage).event
}

/**
 * 在临时账本完整执行装袋共享命令；真实账本只读，任何失败都不会留下回收或装袋事实。
 */
export function preflightWaitHandoverBaggingEvent(
  input: WaitHandoverBaggingEventInput,
  prepareTemporaryStorage?: (storage: BrowserStorageLike) => void,
): void {
  const sourceStorage = resolveWaitHandoverStorage(input.storage)
  const records = new Map<string, string>()
  const ledgerSnapshot = sourceStorage?.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
  if (ledgerSnapshot !== null && ledgerSnapshot !== undefined) {
    records.set(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, ledgerSnapshot)
  }
  const temporaryStorage: BrowserStorageLike = {
    getItem(key) {
      return records.get(key) ?? null
    },
    setItem(key, value) {
      records.set(key, value)
    },
    removeItem(key) {
      records.delete(key)
    },
  }
  prepareTemporaryStorage?.(temporaryStorage)
  appendWaitHandoverBaggingEvent({
    ...input,
    storage: temporaryStorage,
  })
}

export function appendWaitHandoverInboundEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  warehouseArea: string
  locationCode: string
  locationRef?: RuntimeWarehouseLocationRef
  warehouseLocations?: readonly RuntimeWarehouseLocationRef[]
  occurredAt?: string
  usageCycleId?: string
  idempotencyKey?: string
  storage?: BrowserStorageLike | null
}) {
  const storage = resolveWaitHandoverStorage(input.storage)
  if (!input.bagCode.trim()) {
    throw new Error('请扫描或输入中转袋编号。')
  }
  const warehouseLocations = Array.from(input.warehouseLocations ?? (input.locationRef ? [input.locationRef] : []))
  const firstWarehouseLocation = warehouseLocations[0]
  const warehouseArea = firstWarehouseLocation?.areaName || input.warehouseArea
  const locationCode = firstWarehouseLocation?.locationNo || input.locationCode
  if (!warehouseArea.trim() || !locationCode.trim()) {
    throw new Error('请填写入仓库区和库位。')
  }
  const occurredAt = input.occurredAt || new Date().toISOString()
  const snapshot = resolveWaitHandoverBaggingSnapshot(
    input.bagCode,
    storage,
  )
  if (!snapshot?.tickets.length) {
    throw new Error('该中转袋尚未形成菲票装袋快照，不能入仓')
  }
  const tickets = snapshot.tickets
  const usageCycleId =
    input.usageCycleId
    || snapshot.usageCycleId
    || resolveWaitHandoverUsageCycleId(
      input.bagCode,
      occurredAt,
      storage,
    )
  if (
    input.usageCycleId
    && input.usageCycleId !== snapshot.usageCycleId
  ) {
    throw new Error('入仓使用周期与最近确认装袋快照不一致。')
  }
  const idempotencyKey =
    input.idempotencyKey
    || `${usageCycleId}:INBOUND_CONFIRMED`
  const existing = findWaitHandoverIdempotentEvent(
    idempotencyKey,
    storage,
  )
  if (existing) return existing
  assertWaitHandoverActionAllowed({
    bagCode: input.bagCode,
    action: 'INBOUND',
    actionLabel: '入仓',
    storage,
  })
  const totalPieceQty = tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
  const first = tickets[0]
  const payload: FeiTicketInboundPayload = {
    tempBagUseId: `temp-bag:${input.bagCode}:${compactDate(occurredAt)}`,
    bagCode: input.bagCode,
    warehouseArea,
    locationCode,
    inboundBy: input.operator.operatorName,
    inboundAt: occurredAt,
    feiTicketItems: buildWaitHandoverBagSnapshotItems(tickets),
    totalPieceQty,
    mixedFlag: buildMixedFlag(tickets),
    warehouseLocations,
    idempotencyKey,
  }
  return appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '中转袋入仓',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '裁片仓入仓员',
    refs: {
      productionOrderId: first?.productionOrderId || '',
      productionOrderNo: first?.productionOrderNo || '',
      cutOrderId: first?.cutOrderId || '',
      cutOrderNo: first?.cutOrderNo || '',
      spreadingOrderId: first?.spreadingOrderId || '',
      spreadingOrderNo: first?.spreadingOrderNo || '',
      feiTicketIds: tickets.map((ticket) => ticket.feiTicketId).filter(Boolean),
      feiTicketNos: tickets.map((ticket) => ticket.feiTicketNo).filter(Boolean),
      transferBagCode: input.bagCode,
      usageCycleId,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'IN',
      qty: totalPieceQty,
      unit: '片',
      toWarehouseArea: warehouseArea,
      toLocationCode: locationCode,
    },
    payload,
  }, storage).event
}

export function submitWaitHandoverRepackWithSourceReturns(
  input: SubmitTransferBagRepackInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): {
  repackEvent: CuttingRuntimeEvent<'中转袋拆袋重装'>
  inboundEvents: CuttingRuntimeEvent[]
} {
  const retainedSources = input.retainedSources || []
  const occupiedLocations = buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
  const selectedLocationIds = new Set<string>()
  for (const retained of retainedSources) {
    const locationId = retained.returnLocationRef.locationId
    if (!locationId) throw new Error(`${retained.bagCode} 的回仓库位不完整。`)
    if (selectedLocationIds.has(locationId)) throw new Error(`库位 ${retained.returnLocationRef.locationNo} 不能同时放入多个来源袋。`)
    selectedLocationIds.add(locationId)
    const occupiedByOtherBag = occupiedLocations.some((state) =>
      state.locationRef.locationId === locationId && state.bagCode !== retained.bagCode)
    if (occupiedByOtherBag) throw new Error(`库位 ${retained.returnLocationRef.locationNo} 已被其他中转袋占用。`)
  }

  const replay = (targetStorage: BrowserStorageLike | null) => {
    const repackEvent = submitTransferBagRepack(input, targetStorage)
    const payload = parseCompleteTransferBagRepackPayload(repackEvent)
    if (!payload) throw new Error('拆袋重装事实不完整，不能继续来源袋入仓。')
    const inboundEvents = payload.sourceBags
      .filter((sourceBag) => sourceBag.outcome === 'RETURN_INBOUND')
      .map((sourceBag) => {
        if (!sourceBag.returnLocationRef) throw new Error(`${sourceBag.bagCode} 缺少回仓库位。`)
        return appendWaitHandoverInboundEvent({
          source: input.source,
          operator: {
            ...input.operator,
            operatorRole: '裁片仓入仓员',
          },
          bagCode: sourceBag.bagCode,
          warehouseArea: sourceBag.returnLocationRef.areaName,
          locationCode: sourceBag.returnLocationRef.locationNo,
          warehouseLocations: [{ ...sourceBag.returnLocationRef }],
          usageCycleId: sourceBag.usageCycleId,
          occurredAt: input.occurredAt,
          idempotencyKey: `${sourceBag.usageCycleId}:REPACK_RETURN_INBOUND:${input.repackBatchId.trim()}`,
          storage: targetStorage,
        })
      })
    return { repackEvent, inboundEvents }
  }

  if (storage) {
    const records = new Map<string, string>()
    const ledgerValue = storage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
    if (ledgerValue !== null) records.set(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, ledgerValue)
    const temporaryStorage: BrowserStorageLike = {
      getItem: (key) => records.get(key) ?? null,
      setItem: (key, value) => { records.set(key, value) },
      removeItem: (key) => { records.delete(key) },
    }
    replay(temporaryStorage)
  }
  return replay(storage)
}

export function submitWaitHandoverRepackWithSourceReturnsAndResultHandovers(
  input: SubmitTransferBagRepackInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): {
  repackEvent: CuttingRuntimeEvent<'中转袋拆袋重装'>
  inboundEvents: CuttingRuntimeEvent[]
  handoverEvents: CuttingRuntimeEvent<'新增交出记录'>[]
} {
  const replay = (targetStorage: BrowserStorageLike | null) => {
    const outcome = submitWaitHandoverRepackWithSourceReturns(input, targetStorage)
    const payload = parseCompleteTransferBagRepackPayload(outcome.repackEvent)
    if (!payload) throw new Error('拆袋重装事实不完整，不能继续交出结果袋。')
    const handoverEvents = payload.resultBags.map((resultBag, index) => {
      const current = resolveTransferBagCurrentUse(resultBag.bagCode, targetStorage)
      if (!current.usageCycleId || current.usageCycleId !== resultBag.usageCycleId) {
        throw new Error(`${resultBag.bagCode} 的使用周期不完整，不能交出。`)
      }
      const assignments = resultBag.tickets.map((ticket) => ({
        feiTicketId: ticket.feiTicketId,
        feiTicketNo: ticket.feiTicketNo,
        sewingTaskId: ticket.sewingTaskId,
        sewingTaskNo: ticket.sewingTaskNo,
        receiverFactoryId: ticket.receiverFactoryId,
        receiverFactoryName: ticket.receiverFactoryName,
      }))
      const recordKey = `${input.repackBatchId.trim()}:${resultBag.bagCode}`
      return submitWholeBagHandover({
        bagCode: resultBag.bagCode,
        usageCycleId: resultBag.usageCycleId,
        handoverOrderId: `REPACK-HO:${recordKey}`,
        handoverOrderNo: `重装交出-${input.repackBatchId.trim()}-${index + 1}`,
        handoverRecordId: `REPACK-HR:${recordKey}`,
        handoverRecordNo: `重装交出记录-${input.repackBatchId.trim()}-${index + 1}`,
        assignments,
        submittedTicketSnapshot: resultBag.tickets,
        operator: {
          ...input.operator,
          operatorRole: '裁片仓交出员',
        },
        source: input.source,
        occurredAt: input.occurredAt,
        ...(input.handoverContext ? { handoverContext: input.handoverContext } : {}),
      }, targetStorage)
    })
    return { ...outcome, handoverEvents }
  }

  if (storage) {
    const records = new Map<string, string>()
    const ledgerValue = storage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
    if (ledgerValue !== null) records.set(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, ledgerValue)
    const temporaryStorage: BrowserStorageLike = {
      getItem: (key) => records.get(key) ?? null,
      setItem: (key, value) => { records.set(key, value) },
      removeItem: (key) => { records.delete(key) },
    }
    replay(temporaryStorage)
  }
  return replay(storage)
}

export interface SubmitWaitHandoverTaskBatchInput {
  handoverContext: TransferBagHandoverTaskContext
  directBags: Array<{
    bagCode: string
    usageCycleId: string
    assignments: Array<{
      feiTicketId: string
      feiTicketNo: string
      sewingTaskId: string
      sewingTaskNo: string
      receiverFactoryId: string
      receiverFactoryName: string
    }>
    submittedTicketSnapshot: TransferBagTicketFactSnapshot[]
  }>
  repack?: SubmitTransferBagRepackInput
  operator: WaitHandoverRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}

export function submitWaitHandoverTaskBatch(
  input: SubmitWaitHandoverTaskBatchInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): {
  repackEvent?: CuttingRuntimeEvent<'中转袋拆袋重装'>
  inboundEvents: CuttingRuntimeEvent[]
  handoverEvents: CuttingRuntimeEvent<'新增交出记录'>[]
} {
  const context = input.handoverContext
  const replay = (targetStorage: BrowserStorageLike | null) => {
    const repackOutcome = input.repack
      ? submitWaitHandoverRepackWithSourceReturns({
          ...input.repack,
          handoverContext: context,
          operator: input.operator,
          source: input.source,
          occurredAt: input.occurredAt || input.repack.occurredAt,
        }, targetStorage)
      : null
    const repackPayload = repackOutcome
      ? parseCompleteTransferBagRepackPayload(repackOutcome.repackEvent)
      : null
    if (repackOutcome && !repackPayload) {
      throw new Error('拆袋重装事实不完整，不能继续本次交出。')
    }
    const handoverBags = [
      ...input.directBags,
      ...(repackPayload?.resultBags || []).map((bag) => ({
        bagCode: bag.bagCode,
        usageCycleId: bag.usageCycleId,
        assignments: bag.tickets.map((ticket) => ({
          feiTicketId: ticket.feiTicketId,
          feiTicketNo: ticket.feiTicketNo,
          sewingTaskId: ticket.sewingTaskId,
          sewingTaskNo: ticket.sewingTaskNo,
          receiverFactoryId: ticket.receiverFactoryId,
          receiverFactoryName: ticket.receiverFactoryName,
        })),
        submittedTicketSnapshot: bag.tickets,
      })),
    ]
    const duplicatedBag = handoverBags.find((bag, index) =>
      handoverBags.findIndex((candidate) => candidate.bagCode === bag.bagCode) !== index)
    if (duplicatedBag) throw new Error(`中转袋 ${duplicatedBag.bagCode} 在本次交出中重复。`)
    if (!handoverBags.length) throw new Error('本次没有可交出的中转袋。')
    const handoverEvents = handoverBags.map((bag, index) => {
      const recordKey = `${context.handoverBatchId}:${bag.bagCode}`
      return submitWholeBagHandover({
        bagCode: bag.bagCode,
        usageCycleId: bag.usageCycleId,
        handoverOrderId: `TASK-HO:${context.handoverBatchId}`,
        handoverOrderNo: `车缝任务交出-${context.sewingTaskNo}`,
        handoverRecordId: `TASK-HR:${recordKey}`,
        handoverRecordNo: `交出-${context.sewingTaskNo}-${index + 1}`,
        assignments: bag.assignments,
        submittedTicketSnapshot: bag.submittedTicketSnapshot,
        handoverContext: context,
        operator: { ...input.operator, operatorRole: '裁片仓交出员' },
        source: input.source,
        occurredAt: input.occurredAt,
      }, targetStorage)
    })
    return {
      ...(repackOutcome ? { repackEvent: repackOutcome.repackEvent } : {}),
      inboundEvents: repackOutcome?.inboundEvents || [],
      handoverEvents,
    }
  }

  if (storage) {
    const records = new Map<string, string>()
    const ledgerValue = storage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
    if (ledgerValue !== null) records.set(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, ledgerValue)
    const temporaryStorage: BrowserStorageLike = {
      getItem: (key) => records.get(key) ?? null,
      setItem: (key, value) => { records.set(key, value) },
      removeItem: (key) => { records.delete(key) },
    }
    replay(temporaryStorage)
  }
  const originalLedger = storage?.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) ?? null
  try {
    return storage && storage === getBrowserLocalStorage()
      ? runRuntimeTaskAction(() => replay(storage))
      : replay(storage)
  } catch (error) {
    if (storage && storage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) !== originalLedger) {
      if (originalLedger === null) {
        if (!storage.removeItem) throw new Error('交出保存失败，当前存储无法撤回新增记录；请暂停操作并联系主管。')
        storage.removeItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
      } else {
        if (!storage.setItem) throw new Error('交出保存失败，当前存储无法恢复原记录；请暂停操作并联系主管。')
        storage.setItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, originalLedger)
      }
    }
    throw error
  }
}

export function appendWaitHandoverHandoverRecordEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  payload: HandoverRecordSubmitPayload
  fromWarehouseArea: string
  fromLocationCode: string
  locationRef?: RuntimeWarehouseLocationRef
  occurredAt?: string
  usageCycleId?: string
  handoverLegId?: string
  idempotencyKey?: string
  storage?: BrowserStorageLike | null
}) {
  const storage = resolveWaitHandoverStorage(input.storage)
  const occurredAt = input.occurredAt || input.payload.submittedAt || new Date().toISOString()
  if (input.payload.transferBagUses.length !== 1) {
    throw new Error('一次交出只能确认一只完整中转袋。')
  }
  const bagCode = input.payload.transferBagUses[0]?.bagCode?.trim() || ''
  if (!bagCode) {
    throw new Error('请扫描需要整袋交出的中转袋。')
  }
  const existingHandoverRecord = listCuttingRuntimeEvents(storage).find((event) =>
    event.eventStatus !== '已取消'
    && event.eventType === '新增交出记录'
    && (
      (input.idempotencyKey && event.idempotencyKey === input.idempotencyKey)
      || event.refs.handoverRecordId === input.payload.handoverRecordId
    ))
  if (existingHandoverRecord) return existingHandoverRecord
  const snapshot = resolveWaitHandoverBaggingSnapshot(
    bagCode,
    storage,
  )
  if (!snapshot?.tickets.length) {
    throw new Error('该中转袋没有可交出的袋内快照。')
  }
  const usageCycleId =
    input.usageCycleId
    || resolveWaitHandoverUsageCycleId(
      bagCode,
      occurredAt,
      storage,
    )
  if (usageCycleId !== snapshot.usageCycleId) {
    throw new Error('交出使用周期与当前袋内快照不一致。')
  }
  const idempotencyKey =
    input.idempotencyKey
    || `${usageCycleId}:HANDOVER_CONFIRMED:${input.payload.handoverRecordId}`
  const existing = findWaitHandoverIdempotentEvent(
    idempotencyKey,
    storage,
  )
  if (existing) return existing
  assertWaitHandoverActionAllowed({
    bagCode,
    action: 'HANDOVER',
    actionLabel: '整袋交出',
    storage,
  })
  assertWholeBagHandoverPayload({
    bagCode,
    payload: input.payload,
    snapshot,
  })
  const handoverLegId =
    input.handoverLegId
    || buildNextWaitHandoverHandoverLeg({
      bagCode,
      usageCycleId,
      events: listCuttingRuntimeEvents(storage),
    }).handoverLegId
  const locationRef = input.locationRef || resolveActiveWaitHandoverLocationRef(bagCode, usageCycleId, storage)
  if (locationRef === null) throw new Error('无法唯一确认待交出仓库位，请从当前仓库重新发起交出。')
  const warehouseLocations = resolveActiveWaitHandoverLocations(bagCode, usageCycleId, storage)
  const feiTicketIds = input.payload.feiTicketItems.map((item) => item.feiTicketId).filter(Boolean)
  const feiTicketNos = input.payload.feiTicketItems.map((item) => item.feiTicketNo).filter(Boolean)
  return appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '新增交出记录',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '裁片仓交出员',
    refs: {
      handoverOrderId: input.payload.handoverOrderId,
      handoverRecordId: input.payload.handoverRecordId,
      feiTicketIds,
      feiTicketNos,
      transferBagCode: bagCode,
      usageCycleId,
      handoverLegId,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'OUT',
      qty: input.payload.currentHandedOverQty,
      unit: '片',
      fromWarehouseArea: input.fromWarehouseArea,
      fromLocationCode: input.fromLocationCode,
    },
    payload: { ...input.payload, warehouseLocations: warehouseLocations.length ? warehouseLocations : locationRef ? [locationRef] : [] },
  }, storage).event
}

interface SpecialCraftHandoverProjection {
  sources: readonly GeneratedFeiTicketSourceRecord[]
  bindings: readonly CuttingSpecialCraftFeiTicketBinding[]
}

export function appendWaitHandoverSpecialCraftHandoverEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  payload: SpecialCraftHandoverPayload
  handoverOrderId: string
  handoverRecordId: string
  specialCraftId: string
  transferBagCode: string
  fromWarehouseArea: string
  locationRef?: RuntimeWarehouseLocationRef
  occurredAt?: string
  usageCycleId?: string
  handoverLegId?: string
  idempotencyKey?: string
  storage?: BrowserStorageLike | null
}, projection?: SpecialCraftHandoverProjection) {
  if (input.payload.directTransfer) return appendSpecialCraftDirectTransfer(input, projection)
  const storage = resolveWaitHandoverStorage(input.storage)
  const events = sortWaitHandoverEvents(listCuttingRuntimeEvents(storage))
  const occurredAt = input.occurredAt || input.payload.handedOverAt || new Date().toISOString()
  if (!input.transferBagCode.trim()) {
    throw new Error('特殊工艺带袋交出必须明确物理中转袋。')
  }
  const existingSpecialCraftHandover = events.find((event) =>
    event.eventType === '特殊工艺交出'
    && (
      (input.idempotencyKey && event.idempotencyKey === input.idempotencyKey)
      || event.refs.handoverRecordId === input.handoverRecordId
    ))
  if (existingSpecialCraftHandover) {
    if (!isCompleteSuccessfulSpecialCraftHandoverEvent(existingSpecialCraftHandover)) {
      throw new Error(`特殊工艺交出记录 ID ${input.handoverRecordId} 已存在，但事实不完整或业务意图冲突。`)
    }
    const existingPayload = existingSpecialCraftHandover.payload as CompleteSpecialCraftHandoverPayload
    const existingLocationRef = runtimeLocationRef(existingPayload.locationRef)
    const requestedLocationRef = runtimeLocationRef(input.locationRef || input.payload.locationRef)
    const requestedUsageCycleId = input.usageCycleId || existingPayload.usageCycleId
    const requestedLegId = input.handoverLegId || existingPayload.handoverLegId
    const requestedIdempotencyKey = input.idempotencyKey
      || `${requestedUsageCycleId}:HANDOVER_CONFIRMED:${input.handoverRecordId}`
    const currentAuthority = resolveTransferBagAuthoritativeCurrentLocation({
      bagCode: input.transferBagCode,
      usageCycleId: requestedUsageCycleId,
      events,
    })
    const existingIndex = events.findIndex((event) => event.eventId === existingSpecialCraftHandover.eventId)
    const laterInboundFactExists = existingIndex >= 0 && events.slice(existingIndex + 1).some((event) =>
      (event.eventType === '中转袋入仓' || event.eventType === '特殊工艺回仓')
      && (event.eventStatus === '已记录' || event.eventStatus === '已同步')
      && eventTouchesTransferBag(event, input.transferBagCode)
      && getWaitHandoverEventUsageCycleId(event) === requestedUsageCycleId)
    if (!currentAuthority && laterInboundFactExists) {
      throw new Error(`特殊工艺交出记录 ID ${input.handoverRecordId} 的当前权威来源库位缺失，本次重试业务意图冲突。`)
    }
    const retrySourceInventory = currentAuthority || {
      sourceEventId: existingPayload.sourceInventoryEventId,
      warehouseArea: existingPayload.sourceWarehouseArea,
      locationCode: existingPayload.sourceLocationCode,
      ...(existingLocationRef ? { locationRef: existingLocationRef } : {}),
    }
    const retryLocationRef = retrySourceInventory.locationRef
    const requestedLocationMatches = !requestedLocationRef
      || sameRuntimeLocationRef(requestedLocationRef, retryLocationRef)
    const retryCanonicalIntent = buildSpecialCraftWholeBagHandoverCanonicalIntent({
      bagCode: input.transferBagCode,
      usageCycleId: requestedUsageCycleId,
      handoverLegId: requestedLegId,
      handoverOrderId: input.handoverOrderId,
      handoverRecordId: input.handoverRecordId,
      specialCraftId: input.specialCraftId,
      craftCategory: input.payload.craftCategory,
      craftType: input.payload.craftType,
      receiverFactoryId: input.payload.receiverFactoryId,
      receiverFactoryName: input.payload.receiverFactoryName,
      feiTicketItems: input.payload.feiTicketItems,
      ticketSnapshot: existingPayload.ticketSnapshot,
      sourceInventoryEventId: retrySourceInventory.sourceEventId,
      sourceWarehouseArea: retrySourceInventory.warehouseArea,
      sourceLocationCode: retrySourceInventory.locationCode,
      sourceLocationRef: retrySourceInventory.locationRef,
      handedOverAt: occurredAt,
      handedOverBy: input.operator.operatorName,
      idempotencyKey: requestedIdempotencyKey,
      source: input.source,
      operator: {
        ...input.operator,
        operatorRole: input.operator.operatorRole || '特殊工艺交出员',
      },
    })
    if (
      requestedLocationMatches
      && input.payload.handedOverAt === occurredAt
      && input.payload.handedOverBy === input.operator.operatorName
      && retryCanonicalIntent === existingPayload.canonicalIntent
    ) return existingSpecialCraftHandover
    throw new Error(`特殊工艺交出记录 ID ${input.handoverRecordId} 已存在，但本次请求业务意图冲突。`)
  }
  if (input.handoverLegId?.trim()) {
    throw new Error('新特殊工艺交出记录的流转段只能由账本内部生成，不能外部指定。')
  }
  const snapshot = resolveWaitHandoverBaggingSnapshot(
    input.transferBagCode,
    storage,
  )
  if (!snapshot?.tickets.length) {
    throw new Error('该中转袋没有可交出的袋内快照。')
  }
  const usageCycleId =
    input.usageCycleId
    || resolveWaitHandoverUsageCycleId(
      input.transferBagCode,
      occurredAt,
      storage,
    )
  if (usageCycleId !== snapshot.usageCycleId) {
    throw new Error('特殊工艺交出使用周期与当前袋内快照不一致。')
  }
  const idempotencyKey =
    input.idempotencyKey
    || `${usageCycleId}:HANDOVER_CONFIRMED:${input.handoverRecordId}`
  const existingIdempotencyCollision = listCuttingRuntimeEvents(storage).find(
    (event) => event.idempotencyKey === idempotencyKey,
  )
  if (existingIdempotencyCollision) {
    throw new Error(`特殊工艺交出幂等键 ${idempotencyKey} 已存在，但事实不完整或业务意图冲突。`)
  }
  assertWaitHandoverActionAllowed({
    bagCode: input.transferBagCode,
    action: 'HANDOVER',
    actionLabel: '整袋交出',
    storage,
  })
  assertWholeBagSpecialCraftHandoverPayload({
    bagCode: input.transferBagCode,
    payload: input.payload,
    snapshot,
    handoverOrderId: input.handoverOrderId,
    handoverRecordId: input.handoverRecordId,
    specialCraftId: input.specialCraftId,
    occurredAt,
    operatorName: input.operator.operatorName,
  })
  const receipts = listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage), storage)
  const completedBindings = projection?.bindings || listCuttingSpecialCraftFeiTicketBindingsForProjection()
  for (const ticket of snapshot.tickets) {
    if (!isCutPieceTicketUsable(ticket.feiTicketId)) throw new Error(`${ticket.feiTicketNo} 已登记整票不可用，不能继续加工交出。`)
    const sourceTicket = projection?.sources.find(item => item.feiTicketId === ticket.feiTicketId) || getFeiTicketById(ticket.feiTicketId) || listManualFeiTicketSources().find(source => source.feiTicketId === ticket.feiTicketId)
    if (!sourceTicket) continue // 旧来源保持可核查，不由演示名称补造新工艺链。
    const chain = sourceTicket.specialCrafts
    if (!sourceTicket.hasSpecialCraft || !chain.length) throw new Error(`${ticket.feiTicketNo} 没有明确的部位工艺要求，不能交给特殊工艺工厂。`)
    const ticketStageId = input.payload.feiTicketItems.find(item => item.feiTicketId === ticket.feiTicketId)?.specialCraftId
    const index = chain.findIndex(craft => craft.specialCraftId === ticketStageId)
    if (index < 0) throw new Error(`${ticket.feiTicketNo} 的本次工艺与部位要求不一致，请重新选择加工。`)
    const stageBindings = completedBindings.filter(binding => binding.feiTicketId === ticket.feiTicketId && binding.specialCraftId === ticketStageId && binding.taskOrderId === input.handoverOrderId && binding.targetFactoryId === input.payload.receiverFactoryId && binding.assignedFactoryConfirmed === true)
    if (stageBindings.length !== 1) throw new Error(`${ticket.feiTicketNo} 的当前工艺缺少唯一已分配承接任务，请重新核对。`)
    const previous = chain.slice(0, index).map(craft => {
      const receipt = receipts.find(item => item.feiTicketId === ticket.feiTicketId && item.specialCraftId === craft.specialCraftId)
      if (receipt) return receipt.processingCompleted === true && receipt.returnedQty > 0 ? receipt.returnedQty : null
      const bindings = completedBindings.filter(item => item.feiTicketId === ticket.feiTicketId && item.specialCraftId === craft.specialCraftId)
      const binding = bindings.length === 1 ? bindings[0] : undefined
      return binding && ['已完成', '待回仓', '已回仓'].includes(binding.specialCraftFlowStatus) && Number.isSafeInteger(binding.closingQty) && binding.closingQty > 0 ? binding.closingQty : null
    })
    if (previous.some(qty => qty === null)) throw new Error(`${ticket.feiTicketNo} 尚未有明确前道加工完成事实，不能跳到下一道加工。`)
    const currentStageReceipt = receipts.find(receipt => receipt.feiTicketId === ticket.feiTicketId && receipt.specialCraftId === ticketStageId)
    if (currentStageReceipt) throw new Error(`${ticket.feiTicketNo} 的本次工艺已经回仓，请核对下一道加工。`)
    if (index > 0 && ticket.pieceQty !== previous[previous.length - 1]) throw new Error(`${ticket.feiTicketNo} 的本次交出数量必须按前道有效实收更新，请重新读取袋内实物。`)
  }
  const handoverLegId = buildNextWaitHandoverHandoverLeg({
    bagCode: input.transferBagCode,
    usageCycleId,
    events: listCuttingRuntimeEvents(storage),
  }).handoverLegId
  const currentUse = resolveTransferBagCurrentUse(input.transferBagCode, storage)
  if (currentUse.usageCycleId !== usageCycleId || !currentUse.tickets.length) {
    throw new Error('特殊工艺交出提交时的当前袋票快照已变化，请刷新后重试。')
  }
  const totalQty = currentUse.tickets.reduce((sum, item) => sum + Number(item.pieceQty || 0), 0)
  const sourceInventory = resolveActiveWaitHandoverSourceInventory(input.transferBagCode, usageCycleId, storage)
  if (!sourceInventory) throw new Error('无法唯一确认待交出仓库位，请从当前仓库重新发起交出。')
  if (
    input.locationRef
    && !sameRuntimeLocationRef(input.locationRef, sourceInventory.locationRef)
  ) {
    throw new Error('特殊工艺交出的来源库位已变化，请刷新后重试。')
  }
  const locationRef = sourceInventory.locationRef
  const sourceWarehouseArea = sourceInventory.warehouseArea
  const sourceLocationCode = sourceInventory.locationCode
  const operatorRole = input.operator.operatorRole || '特殊工艺交出员'
  const completePayload: CompleteSpecialCraftHandoverPayload = {
    ...input.payload,
    handoverOrderId: input.handoverOrderId,
    handoverRecordId: input.handoverRecordId,
    bagCode: input.transferBagCode,
    usageCycleId,
    handoverLegId,
    ticketSnapshot: currentUse.tickets.map((ticket) => ({ ...ticket })),
    sourceInventoryEventId: sourceInventory.sourceEventId,
    sourceWarehouseArea,
    sourceLocationCode,
    handedOverAt: occurredAt,
    handedOverBy: input.operator.operatorName,
    idempotencyKey,
    locationRef,
    canonicalIntent: '',
  }
  completePayload.canonicalIntent = buildSpecialCraftWholeBagHandoverCanonicalIntent({
    bagCode: input.transferBagCode,
    usageCycleId,
    handoverLegId,
    handoverOrderId: input.handoverOrderId,
    handoverRecordId: input.handoverRecordId,
    specialCraftId: input.specialCraftId,
    craftCategory: completePayload.craftCategory,
    craftType: completePayload.craftType,
    receiverFactoryId: completePayload.receiverFactoryId,
    receiverFactoryName: completePayload.receiverFactoryName,
    feiTicketItems: completePayload.feiTicketItems,
    ticketSnapshot: completePayload.ticketSnapshot,
    sourceInventoryEventId: sourceInventory.sourceEventId,
    sourceWarehouseArea,
    sourceLocationCode,
    sourceLocationRef: locationRef,
    handedOverAt: occurredAt,
    handedOverBy: input.operator.operatorName,
    idempotencyKey,
    source: input.source,
    operator: {
      ...input.operator,
      operatorRole,
    },
  })
  const appendInput: AppendCuttingRuntimeEventInput<'特殊工艺交出'> & { idempotencyKey: string } = {
    idempotencyKey,
    eventType: '特殊工艺交出' as const,
    eventSource: input.source,
    eventStatus: '已同步' as const,
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole,
    refs: {
      handoverOrderId: input.handoverOrderId,
      handoverRecordId: input.handoverRecordId,
      specialCraftId: input.specialCraftId,
      feiTicketIds: input.payload.feiTicketItems.map((item) => item.feiTicketId),
      feiTicketNos: input.payload.feiTicketItems.map((item) => item.feiTicketNo),
      transferBagCode: input.transferBagCode,
      usageCycleId,
      handoverLegId,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'OUT',
      qty: totalQty,
      unit: '片',
      fromWarehouseArea: sourceWarehouseArea,
      fromLocationCode: sourceLocationCode,
    },
    payload: completePayload,
  }
  const candidate: CuttingRuntimeEvent<'特殊工艺交出'> = {
    eventId: 'candidate:special-craft-handover',
    eventNo: 'candidate:special-craft-handover',
    idempotencyKey,
    eventType: appendInput.eventType,
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    createdAt: occurredAt,
    operatorId: input.operator.operatorId || '',
    operatorName: input.operator.operatorName,
    operatorRole,
    refs: appendInput.refs!,
    inventoryEffect: appendInput.inventoryEffect,
    payload: completePayload,
  }
  if (!isCompleteSuccessfulSpecialCraftHandoverEvent(candidate)) {
    throw new Error('特殊工艺整袋交出候选事实不完整，已在写入前拒绝。')
  }
  const appendResult = appendCuttingRuntimeEventIdempotent(appendInput, storage)
  const appendedPayload = appendResult.event.payload as CompleteSpecialCraftHandoverPayload
  if (
    !isCompleteSuccessfulSpecialCraftHandoverEvent(appendResult.event)
    || appendedPayload.canonicalIntent !== completePayload.canonicalIntent
    || appendResult.event.refs.handoverRecordId !== input.handoverRecordId
    || appendResult.event.idempotencyKey !== idempotencyKey
  ) {
    throw new Error(`特殊工艺交出记录 ID ${input.handoverRecordId} 写入结果与候选事实冲突。`)
  }
  return appendResult.event
}

function appendSpecialCraftDirectTransfer(input: Parameters<typeof appendWaitHandoverSpecialCraftHandoverEvent>[0], projection?: SpecialCraftHandoverProjection): CuttingRuntimeEvent<'特殊工艺交出'> {
  const storage = resolveWaitHandoverStorage(input.storage)
  const events = sortWaitHandoverEvents(listCuttingRuntimeEvents(storage))
  const direct = input.payload.directTransfer!
  const facts = listSpecialCraftHandoverFacts(events)
  const source = facts.find(fact => fact.event.eventId === direct.sourceHandoverEventId && fact.handoverRecordId === direct.sourceHandoverRecordId)
  if (!source) throw new Error('未找到上一道实际交出记录，请重新读取。')
  if (source.payload.receiverFactoryId !== direct.sourceFactoryId || source.payload.receiverFactoryName !== direct.sourceFactoryName) throw new Error('当前持有工厂与上一交出记录不一致，请核对。')
  if (source.bagCode !== input.transferBagCode || source.usageCycleId !== input.usageCycleId) throw new Error('中转袋或使用周期已变化，请重新读取。')
  if (source.specialCraftId === input.specialCraftId) throw new Error('请选择下一道加工任务，不能重复同一道工艺。')
  const items = direct.completedTicketItems
  if (items.length !== source.payload.ticketSnapshot.length || new Set(items.map(item => item.feiTicketId)).size !== items.length) throw new Error('请逐票填写全部裁片的加工完成数量。')
  const ticketSnapshot = source.payload.ticketSnapshot.map(ticket => {
    if (!isCutPieceTicketUsable(ticket.feiTicketId)) throw new Error(`${ticket.feiTicketNo} 已不可用，不能转交。`)
    const item = items.find(item => item.feiTicketId === ticket.feiTicketId)
    if (!item || item.specialCraftId !== source.payload.feiTicketItems.find(sourceItem => sourceItem.feiTicketId === ticket.feiTicketId)?.specialCraftId || item.processingCompleted !== true) throw new Error(`${ticket.feiTicketNo}：请核对前道加工完成。`)
    if (!Number.isSafeInteger(item.completedQty) || item.completedQty <= 0 || item.completedQty > ticket.pieceQty) throw new Error(`${ticket.feiTicketNo}：转交数量须为有效整数，且不超过前道实交。`)
    if (item.completedQty !== ticket.pieceQty && !item.differenceReason?.trim()) throw new Error(`${ticket.feiTicketNo}：数量有差异，请填写原因。`)
    return { ...ticket, pieceQty: item.completedQty }
  })
  const occurredAt = input.occurredAt || input.payload.handedOverAt
  if (!occurredAt || input.payload.handedOverAt !== occurredAt || input.payload.handedOverBy !== input.operator.operatorName || new Date(occurredAt.replace(' ', 'T')).getTime() <= new Date(source.event.occurredAt.replace(' ', 'T')).getTime()) throw new Error('转交时间或交出人待核对，请重新填写。')
  const completedFacts = listSpecialCraftProcessingCompletionFacts(events, storage)
  const receipts = listSpecialCraftTicketReturnFacts(events, storage)
  const bindings = projection?.bindings || listCuttingSpecialCraftFeiTicketBindingsForProjection()
  for (const ticket of ticketSnapshot) {
    const original = projection?.sources.find(item => item.feiTicketId === ticket.feiTicketId) || getFeiTicketById(ticket.feiTicketId) || listManualFeiTicketSources().find(item => item.feiTicketId === ticket.feiTicketId)
    if (!original?.hasSpecialCraft) throw new Error(`${ticket.feiTicketNo}：原票工艺要求待补齐，不能直接转交。`)
    const chain = original.specialCrafts
    const previousStageId = source.payload.feiTicketItems.find(item => item.feiTicketId === ticket.feiTicketId)?.specialCraftId
    const nextStageId = input.payload.feiTicketItems.find(item => item.feiTicketId === ticket.feiTicketId)?.specialCraftId
    const sourceIndex = chain.findIndex(craft => craft.specialCraftId === previousStageId)
    if (sourceIndex < 0 || chain[sourceIndex + 1]?.specialCraftId !== nextStageId || !input.payload.feiTicketItems.some(item => item.specialCraftId === input.specialCraftId)) throw new Error(`${ticket.feiTicketNo}：只能转交下一道必要工艺。`)
    const next = chain[sourceIndex + 1]
    if (bindings.filter(binding => binding.feiTicketId === ticket.feiTicketId && binding.specialCraftId === next.specialCraftId && binding.taskOrderId === input.handoverOrderId && binding.assignedFactoryConfirmed === true && binding.targetFactoryId === input.payload.receiverFactoryId).length !== 1) throw new Error(`${ticket.feiTicketNo}：下一道加工任务或承接厂待补齐。`)
    if (chain.slice(0, sourceIndex).some(craft => !completedFacts.some(fact => fact.feiTicketId === ticket.feiTicketId && fact.specialCraftId === craft.specialCraftId) && !receipts.some(fact => fact.feiTicketId === ticket.feiTicketId && fact.specialCraftId === craft.specialCraftId && fact.processingCompleted === true))) throw new Error(`${ticket.feiTicketNo}：前道加工完成记录待核对。`)
  }
  const existing = events.find(event => event.eventType === '特殊工艺交出' && event.refs.handoverRecordId === input.handoverRecordId)
  const handoverLegId = existing?.refs.handoverLegId || buildNextWaitHandoverHandoverLeg({ bagCode: source.bagCode, usageCycleId: source.usageCycleId, events }).handoverLegId
  const idempotencyKey = input.idempotencyKey || `${source.usageCycleId}:DIRECT_HANDOVER:${input.handoverRecordId}`
  const operatorRole = input.operator.operatorRole || '特殊工艺交出员'
  const payload: CompleteSpecialCraftHandoverPayload = { ...input.payload, bagCode: source.bagCode, usageCycleId: source.usageCycleId, handoverLegId, ticketSnapshot,
    sourceInventoryEventId: source.payload.sourceInventoryEventId, sourceWarehouseArea: source.payload.sourceWarehouseArea, sourceLocationCode: source.payload.sourceLocationCode, locationRef: source.payload.locationRef, idempotencyKey, canonicalIntent: '' }
  payload.canonicalIntent = buildSpecialCraftWholeBagHandoverCanonicalIntent({ ...payload, specialCraftId: input.specialCraftId, sourceLocationRef: payload.locationRef, source: input.source, operator: { ...input.operator, operatorRole } })
  if (existing) {
    const prior = facts.find(fact => fact.event.eventId === existing.eventId)
    if (prior?.canonicalIntent === payload.canonicalIntent) return existing as CuttingRuntimeEvent<'特殊工艺交出'>
    throw new Error('转交记录已存在，本次数量或对象不同，请重新读取。')
  }
  const current = resolveTransferBagCurrentUse(source.bagCode, storage)
  if (current.usageCycleId !== source.usageCycleId || current.flowStage !== 'HANDED_OVER_WAITING_RETURN' || current.latestHandoverEventId !== source.event.eventId) throw new Error('该袋已回仓、换袋或转交，当前持有记录已变化。')
  const appendInput: AppendCuttingRuntimeEventInput<'特殊工艺交出'> & { idempotencyKey: string } = { eventType: '特殊工艺交出', eventSource: input.source, eventStatus: '已同步', occurredAt, operatorId: input.operator.operatorId, operatorName: input.operator.operatorName, operatorRole, idempotencyKey,
    refs: { transferBagCode: source.bagCode, usageCycleId: source.usageCycleId, handoverLegId, handoverOrderId: input.handoverOrderId, handoverRecordId: input.handoverRecordId, specialCraftId: input.specialCraftId, feiTicketIds: ticketSnapshot.map(ticket => ticket.feiTicketId), feiTicketNos: ticketSnapshot.map(ticket => ticket.feiTicketNo) },
    inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'ADJUST', qty: 0, unit: '片', fromWarehouseArea: payload.sourceWarehouseArea, fromLocationCode: payload.sourceLocationCode }, payload }
  const candidate = { ...appendInput, eventId: 'candidate:direct-transfer', eventNo: 'candidate:direct-transfer', createdAt: occurredAt, operatorId: input.operator.operatorId || '' } as CuttingRuntimeEvent<'特殊工艺交出'>
  if (!listSpecialCraftHandoverFacts([...events, candidate]).some(fact => fact.event.eventId === candidate.eventId)) throw new Error('转交的前道完成、逐票数量或来源不一致，未保存。')
  return appendCuttingRuntimeEventIdempotent(appendInput, storage).event
}

export function appendWaitHandoverSpecialCraftReturnEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  payload: SpecialCraftReturnPayload
  specialCraftId: string
  occurredAt?: string
  usageCycleId?: string
  handoverLegId?: string
  idempotencyKey?: string
  storage?: BrowserStorageLike | null
}) {
  const storage = resolveWaitHandoverStorage(input.storage)
  const occurredAt = input.occurredAt || input.payload.returnedAt || new Date().toISOString()
  const bagCode = input.payload.transferBagCode?.trim() || ''
  const returnedTicketIds = input.payload.returnedFeiTicketItems
    .map((item) => item.feiTicketId.trim())
    .filter(Boolean)
  if (bagCode && returnedTicketIds.length) {
    return submitSpecialCraftBagReturn({
      sourceHandoverRecordId: input.payload.sourceHandoverRecordId,
      bagCode,
      returnedTicketIds,
      ticketReceipts: input.payload.returnedFeiTicketItems.map(item => ({ feiTicketId: item.feiTicketId, returnedQty: item.returnedQty, differenceReason: item.differenceReason, processingCompleted: item.processingCompleted })),
      locationRef: input.payload.locationRef as RuntimeWarehouseLocationRef,
      operator: input.operator,
      source: input.source,
      occurredAt,
    }, storage)
  }
  if (bagCode && returnedTicketIds.length === 0) {
    return recoverTransferBag({
      bagCode,
      physicalBagReceived: true,
      physicalBagEmpty: true,
      recoveryMode: 'NORMAL',
      recoveryNode: input.payload.receiverFactoryName || '特殊工艺工厂',
      recoveryLocation: [input.payload.warehouseArea, input.payload.locationCode]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' / ') || '裁床待交出仓',
      reason: `特殊工艺空袋回仓：${input.payload.sourceHandoverRecordId}`,
      operator: input.operator,
      source: input.source,
      occurredAt,
    }, storage)
  }
  if (!returnedTicketIds.length) throw new Error('无袋回仓必须包含回仓菲票。')
  return submitSpecialCraftTicketOnlyReturn({
    payload: input.payload,
    specialCraftId: input.specialCraftId,
    operator: input.operator,
    source: input.source,
    occurredAt,
    idempotencyKey: input.idempotencyKey,
  }, storage)
}
