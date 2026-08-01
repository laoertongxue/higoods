import {
  appendCuttingRuntimeEventIdempotent,
  listCuttingRuntimeEvents,
  listCuttingRuntimeEventsByInventoryScope,
  listCuttingRuntimeEventsByType,
  type CuttingRuntimeEvent,
  type CuttingRuntimeEventSource,
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
  eventTouchesTransferBag,
  resolveTransferBagCurrentUse,
} from '../../../data/fcs/cutting/transfer-bag-operations.ts'
import {
  listSpreadingResultGeneratedFeiTickets,
  type GeneratedFeiTicketSourceRecord,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
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
}

export interface WaitHandoverLocationOccupancyState {
  sourceEventId: string
  bagCode: string
  productionOrderNo: string
  feiTicketIds: string[]
  totalPieceQty: number
  inboundAt: string
  inboundBy: string
  locationRef: RuntimeWarehouseLocationRef
  objectNo?: string
  objectName?: string
  usageCycleId?: string
}

function waitHandoverStateKey(bagCode: string, locationRef?: RuntimeWarehouseLocationRef, usageCycleId?: string): string {
  const scope = locationRef
    ? `${locationRef.factoryId}:${locationRef.warehouseId}:${locationRef.warehouseKind}`
    : 'unknown-scope'
  return `${scope}:${usageCycleId || bagCode}:${bagCode}`
}

function findWaitHandoverStateKey(
  states: Map<string, WaitHandoverLocationOccupancyState>,
  bagCode: string,
  usageCycleId?: string,
  locationRef?: RuntimeWarehouseLocationRef | null,
): string | undefined {
  const candidates = Array.from(states.entries()).filter(([, state]) => state.bagCode === bagCode)
    .filter(([, state]) => !locationRef || (
      state.locationRef.factoryId === locationRef.factoryId
      && state.locationRef.warehouseId === locationRef.warehouseId
      && state.locationRef.warehouseKind === locationRef.warehouseKind
    ))
  if (usageCycleId) {
    const cycleCandidates = candidates.filter(([, state]) => state.usageCycleId === usageCycleId)
    return cycleCandidates.length === 1 ? cycleCandidates[0][0] : undefined
  }
  return candidates.length === 1 ? candidates[0][0] : undefined
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
    areaName: runtimeString(record.areaName),
    shelfId: runtimeString(record.shelfId),
    shelfNo: runtimeString(record.shelfNo),
    locationId,
    locationNo: runtimeString(record.locationNo),
  }
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
}): void {
  if (
    !input.payload.handoverRecordId
    || !input.payload.receiverFactoryId
    || !input.payload.receiverFactoryName
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
    input.snapshot.tickets.some(
      (ticket) =>
        payloadQtyByTicket[ticket.feiTicketId]
        !== Number(ticket.pieceQty || 0),
    )
  ) {
    throw new Error('特殊工艺带袋交出数量必须等于完整中转袋袋内快照数量。')
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
  return eventTouchesTransferBag(event, bagCode)
}

function getWaitHandoverRepackBag(
  event: CuttingRuntimeEvent,
  key: 'sourceBags' | 'resultBags',
  bagCode: string,
): Record<string, unknown> | undefined {
  if (event.eventType !== '中转袋拆袋重装') return undefined
  const value = runtimeRecord(event.payload)[key]
  return (Array.isArray(value) ? value : [])
    .map((item) => runtimeRecord(item))
    .find((bag) => runtimeString(bag.bagCode) === bagCode)
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

function inferWaitHandoverEventCycleIds(
  events: CuttingRuntimeEvent[],
  bagCode: string,
): Map<string, string> {
  const result = new Map<string, string>()
  let currentCycleId = ''
  for (const event of [...events].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt)
    || left.eventId.localeCompare(right.eventId))) {
    if (!isWaitHandoverBagEventForCode(event, bagCode)) continue
    const declaredCycleId = getWaitHandoverBagEventUsageCycleId(event, bagCode)
    if (event.eventType === '菲票装袋') {
      currentCycleId = declaredCycleId
        || buildWaitHandoverUsageCycleId(bagCode, event.occurredAt)
    } else if (event.eventType === '中转袋拆袋重装') {
      const resultBag = getWaitHandoverRepackBag(event, 'resultBags', bagCode)
      currentCycleId = resultBag ? declaredCycleId : ''
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
): TransferBagLifecycleFact | null {
  if (event.eventType === '中转袋拆袋重装') {
    const factType = getWaitHandoverRepackBag(event, 'resultBags', bagCode)
      ? 'REPACK_RESULT_CONFIRMED'
      : getWaitHandoverRepackBag(event, 'sourceBags', bagCode)
        ? 'REPACK_SOURCE_EMPTIED'
        : null
    return factType
      ? {
          factId: event.eventId,
          factType,
          usageCycleId,
          occurredAt: event.occurredAt,
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
  }
}

export function listWaitHandoverLifecycleFacts(
  bagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): TransferBagLifecycleFact[] {
  const events = listCuttingRuntimeEvents(storage)
    .filter((event) => isWaitHandoverBagEventForCode(event, bagCode))
  const inferredCycleIds = inferWaitHandoverEventCycleIds(events, bagCode)
  return events
    .map((event) => {
      const usageCycleId =
        getWaitHandoverBagEventUsageCycleId(event, bagCode)
        || inferredCycleIds.get(event.eventId)
        || ''
      return usageCycleId
        ? toWaitHandoverLifecycleFact(event, usageCycleId, bagCode)
        : null
    })
    .filter((fact): fact is TransferBagLifecycleFact => Boolean(fact))
    .sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt)
      || left.factId.localeCompare(right.factId))
}

function listWaitHandoverLifecycleCycles(
  bagCode: string,
  facts: TransferBagLifecycleFact[],
  events: CuttingRuntimeEvent[],
): TransferBagLifecycleCycle[] {
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
      .sort((left, right) =>
        left.occurredAt.localeCompare(right.occurredAt)
        || left.factId.localeCompare(right.factId))
      .at(-1)
    const replacedByRepack = events
      .filter((event) =>
        event.eventType === '中转袋拆袋重装'
        && eventTouchesTransferBag(event, bagCode)
        && runtimeString(getWaitHandoverRepackBag(event, 'sourceBags', bagCode)?.usageCycleId) === fact.usageCycleId
        && runtimeString(getWaitHandoverRepackBag(event, 'resultBags', bagCode)?.usageCycleId) !== fact.usageCycleId)
      .sort((left, right) =>
        left.occurredAt.localeCompare(right.occurredAt)
        || left.eventId.localeCompare(right.eventId))
      .at(-1)
    const closedAt = closeFact?.occurredAt || replacedByRepack?.occurredAt
    return {
      usageCycleId: fact.usageCycleId || '',
      startedAt: fact.occurredAt,
      ...(closedAt
        ? {
            closedAt,
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
  const occurredAt =
    input.returnedAt
    || new Date().toISOString().slice(0, 16).replace('T', ' ')
  const idempotencyKey = `${input.usageCycleId}:PHYSICAL_BAG_RETURNED`
  const existing = findWaitHandoverIdempotentEvent(
    idempotencyKey,
    storage,
  )
  if (existing) return existing
  const lifecycle = assertWaitHandoverActionAllowed({
    bagCode: input.bagCode,
    action: 'PHYSICAL_RETURN',
    actionLabel: '确认物理袋回收',
    storage,
  })
  if (lifecycle.usageCycleId !== input.usageCycleId) {
    throw new Error('回收使用周期与中转袋当前使用周期不一致。')
  }
  if (!input.returnWarehouseName.trim()) {
    throw new Error('请填写物理袋回收位置。')
  }
  return appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '中转袋回收',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '中转袋回收员',
    refs: {
      transferBagCode: input.bagCode,
      usageCycleId: input.usageCycleId,
    },
    payload: {
      bagCode: input.bagCode,
      usageCycleId: input.usageCycleId,
      returnWarehouseName: input.returnWarehouseName,
      returnedAt: occurredAt,
      returnedBy: input.operator.operatorName,
      note: input.note || '',
    },
  }, storage).event
}

export function appendWaitHandoverScrapEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  usageCycleId?: string
  scrappedAt?: string
  reason: string
  storage?: BrowserStorageLike | null
}) {
  const storage = resolveWaitHandoverStorage(input.storage)
  if (!input.bagCode.trim()) {
    throw new Error('请明确扫描或选择需要报废的物理中转袋。')
  }
  if (!input.reason.trim()) {
    throw new Error('确认报废必须填写报废原因。')
  }
  const occurredAt =
    input.scrappedAt
    || new Date().toISOString().slice(0, 16).replace('T', ' ')
  const usageCycleId =
    input.usageCycleId
    || resolveWaitHandoverUsageCycleId(
      input.bagCode,
      occurredAt,
      storage,
    )
  const idempotencyKey = `${input.bagCode}:BAG_SCRAPPED`
  const existing = findWaitHandoverIdempotentEvent(
    idempotencyKey,
    storage,
  )
  if (existing) return existing
  assertWaitHandoverActionAllowed({
    bagCode: input.bagCode,
    action: 'SCRAP',
    actionLabel: '确认报废',
    storage,
  })
  return appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '中转袋报废',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '中转袋主管',
    refs: {
      transferBagCode: input.bagCode,
      usageCycleId,
    },
    payload: {
      bagCode: input.bagCode,
      usageCycleId,
      scrappedAt: occurredAt,
      scrappedBy: input.operator.operatorName,
      reason: input.reason,
    },
  }, storage).event
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
  const events = listCuttingRuntimeEvents(storage)
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
  const handoverLegIds = new Set(
    input.events
      .filter((event) =>
        isWaitHandoverBagEventForCode(event, input.bagCode)
        && getWaitHandoverEventUsageCycleId(event) === input.usageCycleId
        && (
          event.eventType === '新增交出记录'
          || event.eventType === '特殊工艺交出'
        ))
      .map((event) => event.refs.handoverLegId)
      .filter(Boolean),
  )
  const handoverSequence = handoverLegIds.size + 1
  return {
    handoverLegId:
      `${input.usageCycleId}:handover:${handoverSequence}`,
    handoverSequence,
  }
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
    cutOrderId:
      runtimeString(item.cutOrderId)
      || event.refs.cutOrderId
      || '',
    cutOrderNo:
      runtimeString(item.cutOrderNo)
      || event.refs.cutOrderNo
      || '',
    spreadingOrderId:
      runtimeString(item.spreadingOrderId)
      || event.refs.spreadingOrderId
      || '',
    spreadingOrderNo:
      runtimeString(item.spreadingOrderNo)
      || event.refs.spreadingOrderNo
      || '',
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
    color: ticket.skuColor || ticket.fabricColor,
    size: ticket.skuSize,
    partCode: ticket.partCode,
    partName: ticket.partName,
    pieceQty: ticket.actualCutPieceQty || ticket.qty || 0,
    pieceSequenceLabel: ticket.pieceSequenceLabel || ticket.pieceSetNoRange || '按菲票追踪',
    hasSpecialCraft: Boolean(ticket.hasSpecialCraft),
    specialCraftDisplay: getSpecialCraftDisplay(ticket),
    receiverFactoryDisplay: getReceiverFactoryDisplay(ticket),
    printStatus: getRuntimeTicketPrintStatus(ticket),
    voidStatus: getRuntimeTicketVoidStatus(ticket),
  }
}

export function buildWaitHandoverRuntimeTicketFromTransferCandidate(ticket: TransferBagTicketCandidate): WaitHandoverRuntimeTicketInput {
  return {
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
    specialCraftDisplay: ticket.hasSpecialCraft ? ticket.specialCraftDisplayLabel || '特殊工艺待维护' : '无',
    receiverFactoryDisplay: ticket.hasSpecialCraft ? ticket.receiverFactoryDisplay || '承接工厂待补充' : '无',
    printStatus: ticket.printStatus === 'WAIT_PRINT' ? '待打印' : ticket.printStatus === 'VOIDED' ? '已作废' : '已打印',
    voidStatus: ticket.ticketStatus === 'VOIDED' || ticket.printStatus === 'VOIDED' ? '已作废' : '有效',
  }
}

export function listWaitHandoverRuntimeEvents(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent[] {
  const events = [
    ...listCuttingRuntimeEventsByInventoryScope('裁床待交出仓', storage),
    ...listCuttingRuntimeEventsByType('菲票装袋', storage),
    ...listCuttingRuntimeEventsByType('中转袋入仓', storage),
    ...listCuttingRuntimeEventsByType('中转袋拆袋重装', storage),
    ...listCuttingRuntimeEventsByType('交出装袋确认', storage),
    ...listCuttingRuntimeEventsByType('新增交出记录', storage),
    ...listCuttingRuntimeEventsByType('特殊工艺交出', storage),
    ...listCuttingRuntimeEventsByType('特殊工艺回仓', storage),
    ...listCuttingRuntimeEventsByType('中转袋回收', storage),
    ...listCuttingRuntimeEventsByType('中转袋报废', storage),
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
  const events = [...runtimeEvents]
    .filter((event) => event.eventStatus !== '已取消')
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt, 'zh-CN'))

  for (const event of events) {
    const payload = runtimeRecord(event.payload)
    if (event.eventType === '中转袋入仓') {
      const bagCode = runtimeString(payload.bagCode) || event.refs.transferBagCode || ''
      const locationRef = runtimeLocationRef(payload.locationRef)
      if (!bagCode || !locationRef) continue
       states.set(waitHandoverStateKey(bagCode, locationRef, runtimeString(payload.usageCycleId) || event.refs.usageCycleId), {
        sourceEventId: event.eventId,
        bagCode,
        productionOrderNo: event.refs.productionOrderNo || '',
        feiTicketIds: [...(event.refs.feiTicketIds ?? [])],
        totalPieceQty: runtimeNumber(payload.totalPieceQty) || Number(event.inventoryEffect?.qty || 0),
        inboundAt: runtimeString(payload.inboundAt) || event.occurredAt,
        inboundBy: runtimeString(payload.inboundBy) || event.operatorName,
         locationRef,
         usageCycleId: runtimeString(payload.usageCycleId) || event.refs.usageCycleId,
      })
      continue
    }
    if (event.eventType === '中转袋拆袋重装') {
      const repack = event.payload as TransferBagRepackPayload
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
      const sourceKey = sourceBagCode ? findWaitHandoverStateKey(states, sourceBagCode, event.refs.usageCycleId, eventLocationRef) : undefined
      const source = sourceKey ? states.get(sourceKey) : undefined
      if (!source || !targetBagCode) continue
       states.delete(sourceKey!)
       states.set(waitHandoverStateKey(targetBagCode, source.locationRef, event.refs.usageCycleId || source.usageCycleId), {
        ...source,
        sourceEventId: event.eventId,
         bagCode: targetBagCode,
         usageCycleId: event.refs.usageCycleId || source.usageCycleId,
        feiTicketIds: event.refs.feiTicketIds?.length ? [...event.refs.feiTicketIds] : source.feiTicketIds,
        totalPieceQty: Number(event.inventoryEffect?.qty || source.totalPieceQty),
      })
      continue
    }
    if (event.eventType === '新增交出记录') {
      const bagCode = event.refs.transferBagCode || runtimeString(payload.transferBagCode)
      const stateKey = bagCode ? findWaitHandoverStateKey(states, bagCode, event.refs.usageCycleId, runtimeLocationRef(payload.locationRef)) : undefined
      if (stateKey) states.delete(stateKey)
      continue
    }
    if (event.eventType === '特殊工艺交出') {
      const bagCode = event.refs.transferBagCode || runtimeString(payload.transferBagCode)
       const stateKey = bagCode ? findWaitHandoverStateKey(states, bagCode, event.refs.usageCycleId, runtimeLocationRef(payload.locationRef)) : undefined
       const current = stateKey ? states.get(stateKey) : undefined
      if (!bagCode || !current) continue
      const handedOverQty = Number(event.inventoryEffect?.qty || runtimeNumber(payload.handoverQty))
      const remainingQty = Math.max(0, current.totalPieceQty - handedOverQty)
      if (remainingQty <= 0) {
         if (stateKey) states.delete(stateKey)
      } else {
         states.set(stateKey!, {
          ...current,
          sourceEventId: event.eventId,
          totalPieceQty: remainingQty,
        })
      }
      continue
    }
    if (event.eventType === '特殊工艺回仓') {
      const returnRecordId = runtimeString(payload.returnRecordId) || event.eventId
      const bagCode = runtimeString(payload.transferBagCode) || event.refs.transferBagCode || `return:${returnRecordId}`
      const locationRef = runtimeLocationRef(payload.locationRef)
      if (!locationRef) continue
       const stateKey = findWaitHandoverStateKey(states, bagCode, event.refs.usageCycleId, locationRef)
       const current = stateKey ? states.get(stateKey) : undefined
      const returnedQty = Number(event.inventoryEffect?.qty || 0)
       states.set(stateKey || waitHandoverStateKey(bagCode, locationRef, event.refs.usageCycleId), {
        sourceEventId: event.eventId,
        bagCode,
        productionOrderNo: event.refs.productionOrderNo || current?.productionOrderNo || '',
        feiTicketIds: Array.from(new Set([
          ...(current?.feiTicketIds ?? []),
          ...(event.refs.feiTicketIds ?? []),
        ])),
        totalPieceQty: Number(current?.totalPieceQty || 0) + returnedQty,
        inboundAt: runtimeString(payload.returnedAt) || event.occurredAt,
        inboundBy: runtimeString(payload.returnedBy) || event.operatorName,
         locationRef,
         usageCycleId: event.refs.usageCycleId || current?.usageCycleId,
        objectNo: runtimeString(payload.transferBagCode) || runtimeString(payload.returnRecordNo) || returnRecordId,
        objectName: runtimeString(payload.transferBagCode)
          ? `中转袋 ${runtimeString(payload.transferBagCode)}`
          : `特殊工艺回仓 ${runtimeString(payload.returnRecordNo) || returnRecordId}`,
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
  return candidates.length === 1 ? candidates[0].locationRef : candidates.length > 1 ? null : undefined
}

export function buildWaitHandoverRuntimeProjection(
  generatedTickets = listSpreadingResultGeneratedFeiTickets(),
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
    bagCodes.flatMap((bagCode) =>
      resolveTransferBagCurrentUse(bagCode, storage).tickets.map((ticket) => ticket.feiTicketId)),
  )
  return {
    runtimeEvents,
    generatedTickets,
    inboundTempBags,
    inboundInventoryRecords,
    ticketCandidates: generatedTickets.filter((ticket) => !currentTicketIds.has(ticket.feiTicketId)),
    baggingConfirmEvents: runtimeEvents.filter((event) => event.eventType === '交出装袋确认'),
    handoverRecordEvents: runtimeEvents.filter((event) => event.eventType === '新增交出记录'),
  }
}

export function runtimeEventHasWaitHandoverTicket(eventType: string, feiTicketId: string, specialCraftId?: string): boolean {
  return listCuttingRuntimeEvents().some((event) => {
    if (event.eventType !== eventType || event.eventStatus === '已取消') return false
    if (!event.refs.feiTicketIds?.includes(feiTicketId)) return false
    if (specialCraftId && event.refs.specialCraftId !== specialCraftId) return false
    return true
  })
}

export function appendWaitHandoverBaggingEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  tickets: WaitHandoverRuntimeTicketInput[]
  occurredAt?: string
  usageCycleId?: string
  idempotencyKey?: string
  storage?: BrowserStorageLike | null
}) {
  const storage = resolveWaitHandoverStorage(input.storage)
  if (!input.bagCode.trim()) {
    throw new Error('请扫描或输入中转袋编号。')
  }
  const occurredAt = input.occurredAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
  const usageCycleId =
    input.usageCycleId
    || buildWaitHandoverUsageCycleId(input.bagCode, occurredAt)
  const tickets = input.tickets
  if (!tickets.length) {
    throw new Error('请至少选择或扫描一张有效菲票。')
  }
  const productionOrderNos = uniqueStrings(
    tickets.map((ticket) => ticket.productionOrderNo),
  )
  if (productionOrderNos.length !== 1) {
    throw new Error('同一中转袋只能装入同一生产单的菲票')
  }
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

export function appendWaitHandoverInboundEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  warehouseArea: string
  locationCode: string
  locationRef?: RuntimeWarehouseLocationRef
  occurredAt?: string
  usageCycleId?: string
  idempotencyKey?: string
  storage?: BrowserStorageLike | null
}) {
  const storage = resolveWaitHandoverStorage(input.storage)
  if (!input.bagCode.trim()) {
    throw new Error('请扫描或输入中转袋编号。')
  }
  if (!input.warehouseArea.trim() || !input.locationCode.trim()) {
    throw new Error('请填写入仓库区和库位。')
  }
  const occurredAt = input.occurredAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
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
    warehouseArea: input.warehouseArea,
    locationCode: input.locationCode,
    inboundBy: input.operator.operatorName,
    inboundAt: occurredAt,
    feiTicketItems: buildWaitHandoverBagSnapshotItems(tickets),
    totalPieceQty,
    mixedFlag: buildMixedFlag(tickets),
    locationRef: input.locationRef,
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
      toWarehouseArea: input.warehouseArea,
      toLocationCode: input.locationCode,
    },
    payload,
  }, storage).event
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
    payload: { ...input.payload, locationRef },
  }, storage).event
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
}) {
  const storage = resolveWaitHandoverStorage(input.storage)
  const occurredAt = input.occurredAt || input.payload.handedOverAt || new Date().toISOString()
  if (!input.transferBagCode.trim()) {
    throw new Error('特殊工艺带袋交出必须明确物理中转袋。')
  }
  const existingSpecialCraftHandover = listCuttingRuntimeEvents(storage).find((event) =>
    event.eventStatus !== '已取消'
    && event.eventType === '特殊工艺交出'
    && (
      (input.idempotencyKey && event.idempotencyKey === input.idempotencyKey)
      || event.refs.handoverRecordId === input.handoverRecordId
    ))
  if (existingSpecialCraftHandover) return existingSpecialCraftHandover
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
  const existing = findWaitHandoverIdempotentEvent(
    idempotencyKey,
    storage,
  )
  if (existing) return existing
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
  })
  const handoverLegId =
    input.handoverLegId
    || buildNextWaitHandoverHandoverLeg({
      bagCode: input.transferBagCode,
      usageCycleId,
      events: listCuttingRuntimeEvents(storage),
    }).handoverLegId
  const totalQty = input.payload.feiTicketItems.reduce((sum, item) => sum + Number(item.pieceQty || 0), 0)
  const locationRef = input.locationRef || resolveActiveWaitHandoverLocationRef(input.transferBagCode, usageCycleId, storage)
  if (locationRef === null) throw new Error('无法唯一确认待交出仓库位，请从当前仓库重新发起交出。')
  return appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '特殊工艺交出',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '特殊工艺交出员',
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
      fromWarehouseArea: input.fromWarehouseArea,
      fromLocationCode: input.transferBagCode,
    },
    payload: { ...input.payload, locationRef },
  }, storage).event
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
  const bagCode = input.payload.transferBagCode || ''
  const usageCycleId =
    input.usageCycleId
    || (
      bagCode
        ? resolveWaitHandoverUsageCycleId(
          bagCode,
          occurredAt,
          storage,
        )
        : ''
    )
  const activeHandoverLegId =
    input.handoverLegId
    || (
      bagCode
        ? buildWaitHandoverLifecycleByBagCode(
          bagCode,
          storage,
        ).activeHandoverLegId
        : null
    )
    || undefined
  const idempotencyKey =
    input.idempotencyKey
    || `${usageCycleId || 'ticket-only'}:SPECIAL_CRAFT_RETURN:${input.payload.returnRecordId}`
  const existing = findWaitHandoverIdempotentEvent(
    idempotencyKey,
    storage,
  )
  if (existing) return existing
  if (bagCode) {
    const lifecycle = assertWaitHandoverActionAllowed({
      bagCode,
      action: 'SPECIAL_CRAFT_RETURN',
      actionLabel: '确认特殊工艺带袋回仓',
      storage,
    })
    if (lifecycle.usageCycleId !== usageCycleId) {
      throw new Error('特殊工艺回仓使用周期与当前物理袋不一致。')
    }
    if (
      !input.payload.sourceHandoverRecordId
      || !input.payload.warehouseArea
      || !input.payload.locationCode
    ) {
      throw new Error('带袋特殊工艺回仓必须保留来源交出记录、库区和库位。')
    }
    if (!activeHandoverLegId) {
      throw new Error('当前中转袋没有可关闭的交出流转段。')
    }
  }
  const returnedQty = input.payload.returnedFeiTicketItems.reduce((sum, item) => sum + Number(item.returnedQty || 0), 0)
  return appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '特殊工艺回仓',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '特殊工艺回仓员',
    refs: {
      handoverOrderId: input.payload.sourceHandoverOrderId,
      handoverRecordId: input.payload.sourceHandoverRecordId,
      specialCraftId: input.specialCraftId,
      feiTicketIds: input.payload.returnedFeiTicketItems.map((item) => item.feiTicketId),
      feiTicketNos: input.payload.returnedFeiTicketItems.map((item) => item.feiTicketNo),
      transferBagCode: bagCode,
      usageCycleId: usageCycleId || undefined,
      handoverLegId: activeHandoverLegId,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'IN',
      qty: returnedQty,
      unit: '片',
      toWarehouseArea: input.payload.warehouseArea,
      toLocationCode: input.payload.locationCode,
    },
    payload: input.payload,
  }, storage).event
}
