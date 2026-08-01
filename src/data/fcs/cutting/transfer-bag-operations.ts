import {
  appendCuttingRuntimeEventIdempotent,
  listCuttingRuntimeEvents,
  type CuttingRuntimeEvent,
  type CuttingRuntimeEventSource,
  type RuntimeWarehouseLocationRef,
  type TransferBagRepackPayload,
  type TransferBagTicketFactSnapshot,
  type WholeBagHandoverSubmitPayload,
} from './cutting-runtime-event-ledger.ts'
import type { FeiTicketSewingAssignment } from './sewing-dispatch.ts'
import { compareCuttingRuntimeChronologyAscending } from './cutting-runtime-chronology.ts'
import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../browser-storage.ts'
import type {
  TransferBagFlowStageKey,
  TransferBagMainStatusKey,
} from './transfer-bag-lifecycle.ts'

export interface TransferBagCurrentUse {
  bagCode: string
  usageCycleId: string | null
  productionOrderNo: string
  tickets: TransferBagTicketFactSnapshot[]
  mainStatus: TransferBagMainStatusKey
  flowStage: TransferBagFlowStageKey | null
  latestHandoverEventId: string
  compatibilityBlockedReason?: string
}

export interface TransferBagRuntimeOperator {
  operatorId?: string
  operatorName: string
  operatorRole?: string
}

export interface SubmitTransferBagRepackInput {
  repackBatchId: string
  sourceBagCodes: string[]
  results: Array<{
    bagCode: string
    feiTicketIds: string[]
  }>
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}

export interface WholeBagHandoverEligibility {
  ok: boolean
  reason: string
  receiverFactoryId: string
  receiverFactoryName: string
  sewingTaskIds: string[]
  sewingTaskNos: string[]
  ticketSnapshot: TransferBagTicketFactSnapshot[]
}

export interface ResolveWholeBagHandoverEligibilityInput {
  currentUse: TransferBagCurrentUse
  assignments: FeiTicketSewingAssignment[]
  existingHandoverEvents?: CuttingRuntimeEvent[]
  submittedTicketSnapshot: TransferBagTicketFactSnapshot[]
}

export interface SubmitWholeBagHandoverInput {
  bagCode: string
  usageCycleId: string
  handoverOrderId: string
  handoverOrderNo: string
  handoverRecordId: string
  handoverRecordNo: string
  assignments: FeiTicketSewingAssignment[]
  submittedTicketSnapshot: TransferBagTicketFactSnapshot[]
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : []
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function sameStrings(left: string[], right: string[]): boolean {
  const a = [...left].sort()
  const b = [...right].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function failedWholeBagHandover(reason: string): WholeBagHandoverEligibility {
  return {
    ok: false,
    reason,
    receiverFactoryId: '',
    receiverFactoryName: '',
    sewingTaskIds: [],
    sewingTaskNos: [],
    ticketSnapshot: [],
  }
}

const WHOLE_BAG_SNAPSHOT_FIELDS: Array<keyof TransferBagTicketFactSnapshot> = [
  'feiTicketId',
  'feiTicketNo',
  'productionOrderId',
  'productionOrderNo',
  'cutOrderId',
  'cutOrderNo',
  'color',
  'size',
  'partCode',
  'partName',
  'pieceQty',
  'sewingTaskId',
  'sewingTaskNo',
  'receiverFactoryId',
  'receiverFactoryName',
]

function sameWholeBagTicketSnapshot(
  left: TransferBagTicketFactSnapshot[],
  right: TransferBagTicketFactSnapshot[],
): boolean {
  if (left.length !== right.length) return false
  const normalizedLeft = left.map(normalizeWholeBagTicketSnapshot)
  const normalizedRight = right.map(normalizeWholeBagTicketSnapshot)
  const rightById = new Map(normalizedRight.map((ticket) => [ticket.feiTicketId, ticket]))
  if (rightById.size !== right.length) return false
  return normalizedLeft.every((ticket) => {
    const expected = rightById.get(ticket.feiTicketId)
    return Boolean(expected)
      && WHOLE_BAG_SNAPSHOT_FIELDS.every((field) => ticket[field] === expected?.[field])
  })
}

function normalizeWholeBagTicketSnapshot(
  ticket: TransferBagTicketFactSnapshot,
): TransferBagTicketFactSnapshot {
  return {
    ...ticket,
    feiTicketId: text(ticket.feiTicketId),
    feiTicketNo: text(ticket.feiTicketNo),
    productionOrderId: text(ticket.productionOrderId),
    productionOrderNo: text(ticket.productionOrderNo),
    cutOrderId: text(ticket.cutOrderId),
    cutOrderNo: text(ticket.cutOrderNo),
    color: text(ticket.color),
    size: text(ticket.size),
    partCode: text(ticket.partCode),
    partName: text(ticket.partName),
    sewingTaskId: text(ticket.sewingTaskId),
    sewingTaskNo: text(ticket.sewingTaskNo),
    receiverFactoryId: text(ticket.receiverFactoryId),
    receiverFactoryName: text(ticket.receiverFactoryName),
  }
}

function normalizeRequiredSubmittedTicketSnapshot(
  value: unknown,
): TransferBagTicketFactSnapshot[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error('整袋交出的完整提交快照必填。')
  }
  const snapshot = value.map((item) => normalizeWholeBagTicketSnapshot(record(item) as unknown as TransferBagTicketFactSnapshot))
  const incomplete = snapshot.find((item) =>
    WHOLE_BAG_SNAPSHOT_FIELDS.some((field) => field === 'pieceQty'
      ? !Number.isFinite(item.pieceQty) || item.pieceQty <= 0
      : !text(item[field])))
  if (incomplete) {
    throw new Error(`整袋交出的提交快照不完整：${incomplete.feiTicketNo || incomplete.feiTicketId || '未知菲票'}。`)
  }
  const ticketIds = snapshot.map((item) => item.feiTicketId)
  const duplicateTicketId = ticketIds.find((ticketId, index) => ticketIds.indexOf(ticketId) !== index)
  if (duplicateTicketId) {
    throw new Error(`整袋交出的提交快照存在重复菲票：${duplicateTicketId}。`)
  }
  return snapshot
}

function normalizeRequiredAssignments(value: unknown): FeiTicketSewingAssignment[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error('整袋交出的逐票车缝任务分配必填。')
  }
  const assignments = value.map((item) => {
    const source = record(item)
    return {
      feiTicketId: text(source.feiTicketId),
      feiTicketNo: text(source.feiTicketNo),
      sewingTaskId: text(source.sewingTaskId),
      sewingTaskNo: text(source.sewingTaskNo),
      receiverFactoryId: text(source.receiverFactoryId),
      receiverFactoryName: text(source.receiverFactoryName),
    }
  })
  const incomplete = assignments.find((item) => Object.values(item).some((field) => !field))
  if (incomplete) {
    throw new Error(`整袋交出的逐票任务分配不完整：${incomplete?.feiTicketNo || incomplete?.feiTicketId || '未知菲票'}。`)
  }
  const ticketIds = assignments.map((item) => item.feiTicketId)
  const duplicateTicketId = ticketIds.find((ticketId, index) => ticketIds.indexOf(ticketId) !== index)
  if (duplicateTicketId) {
    throw new Error(`菲票 ${duplicateTicketId} 存在重复分配，不能整袋交出。`)
  }
  return assignments
}

export function resolveWholeBagHandoverEligibility(
  input: ResolveWholeBagHandoverEligibilityInput,
): WholeBagHandoverEligibility {
  const { currentUse } = input
  // 核心业务校验顺序固定为：阶段 → 非空 → 单生产单 → 逐票分配 →
  // 唯一接收工厂 → 当前周期重复交出 → 完整提交快照；兼容阻断只能在其后追加。
  if (currentUse.flowStage !== 'INBOUND_STORED' && currentUse.flowStage !== 'READY_HANDOVER') {
    return failedWholeBagHandover('当前中转袋不是入仓暂存中或待交出，不能整袋交出。')
  }
  if (!currentUse.tickets.length) {
    return failedWholeBagHandover('当前中转袋没有菲票，不能整袋交出。')
  }

  const productionOrderNos = unique(currentUse.tickets.map((ticket) => ticket.productionOrderNo))
  if (
    productionOrderNos.length !== 1
    || !productionOrderNos[0]
    || currentUse.productionOrderNo.trim() !== productionOrderNos[0]
  ) {
    return failedWholeBagHandover('一个中转袋当前只能包含同一生产单的菲票。')
  }

  const currentTicketIds = currentUse.tickets.map((ticket) => ticket.feiTicketId.trim())
  if (currentTicketIds.some((ticketId) => !ticketId)) {
    return failedWholeBagHandover('当前袋内存在无法唯一识别的菲票，不能整袋交出。')
  }
  if (new Set(currentTicketIds).size !== currentTicketIds.length) {
    return failedWholeBagHandover('当前袋票关系存在重复菲票，不能整袋交出。')
  }
  const incompleteTicket = currentUse.tickets.find((ticket) =>
    !ticket.feiTicketNo.trim()
    || !ticket.productionOrderId.trim()
    || !ticket.cutOrderId.trim()
    || !ticket.cutOrderNo.trim()
    || !ticket.color.trim()
    || !ticket.size.trim()
    || !ticket.partCode.trim()
    || !ticket.partName.trim()
    || !Number.isFinite(ticket.pieceQty)
    || ticket.pieceQty <= 0)
  if (incompleteTicket) {
    return failedWholeBagHandover(`菲票 ${incompleteTicket.feiTicketNo || incompleteTicket.feiTicketId} 的当前袋内事实不完整。`)
  }
  let assignments: FeiTicketSewingAssignment[]
  try {
    assignments = normalizeRequiredAssignments(input.assignments)
  } catch (error) {
    return failedWholeBagHandover(error instanceof Error ? error.message : '整袋交出的逐票车缝任务分配无效。')
  }
  const assignmentTicketIds = assignments.map((assignment) => assignment.feiTicketId)

  const currentTicketIdSet = new Set(currentTicketIds)
  const assignmentByTicketId = new Map(
    assignments.map((assignment) => [assignment.feiTicketId, assignment]),
  )
  const missingTicketIds = currentTicketIds.filter((ticketId) => !assignmentByTicketId.has(ticketId))
  if (missingTicketIds.length) {
    return failedWholeBagHandover(`袋内菲票未分配车缝任务：${missingTicketIds.join('、')}。`)
  }
  const extraTicketIds = assignmentTicketIds.filter((ticketId) => !currentTicketIdSet.has(ticketId))
  if (extraTicketIds.length) {
    return failedWholeBagHandover(`分配结果包含当前袋外的额外菲票：${extraTicketIds.join('、')}。`)
  }

  for (const ticket of currentUse.tickets) {
    const assignment = assignmentByTicketId.get(ticket.feiTicketId)!
    if (assignment.feiTicketNo.trim() !== ticket.feiTicketNo.trim()) {
      return failedWholeBagHandover(`菲票 ${ticket.feiTicketId} 的票号与分配结果不一致。`)
    }
    if (
      !assignment.sewingTaskId.trim()
      || !assignment.sewingTaskNo.trim()
      || !assignment.receiverFactoryId.trim()
      || !assignment.receiverFactoryName.trim()
    ) {
      return failedWholeBagHandover(`菲票 ${ticket.feiTicketNo} 的车缝任务或接收工厂信息不完整。`)
    }
  }

  const assignmentsInTicketOrder = currentUse.tickets.map((ticket) =>
    assignmentByTicketId.get(ticket.feiTicketId)!)
  const receiverFactoryIds = unique(assignmentsInTicketOrder.map((assignment) => assignment.receiverFactoryId))
  if (receiverFactoryIds.length !== 1) {
    return failedWholeBagHandover('袋内菲票分配给多个车缝工厂，请先拆袋重装。')
  }
  const receiverFactoryNames = unique(assignmentsInTicketOrder.map((assignment) => assignment.receiverFactoryName))
  if (receiverFactoryNames.length !== 1) {
    return failedWholeBagHandover('同一接收工厂的名称不一致，请先核对车缝任务分配。')
  }

  const conflictingHandover = (input.existingHandoverEvents || []).find((event) => {
    if (event.eventStatus === '已取消' || event.eventType !== '新增交出记录') return false
    const payload = eventPayload(event)
    const bagUse = records(payload.transferBagUses)
      .find((value) => text(value.bagCode) === currentUse.bagCode)
    const handoverUsageCycleId = eventUsageCycleId(event) || text(bagUse?.bagUseId)
    return handoverUsageCycleId && currentUse.usageCycleId
      ? handoverUsageCycleId === currentUse.usageCycleId
      : eventTouchesTransferBag(event, currentUse.bagCode)
  })
  if (conflictingHandover) {
    return failedWholeBagHandover('当前中转袋使用周期已有未完成或重复交出事实，不能再次交出。')
  }

  const ticketSnapshot = currentUse.tickets.map((ticket) => {
    const assignment = assignmentByTicketId.get(ticket.feiTicketId)!
    return {
      ...ticket,
      sewingTaskId: assignment.sewingTaskId.trim(),
      sewingTaskNo: assignment.sewingTaskNo.trim(),
      receiverFactoryId: assignment.receiverFactoryId.trim(),
      receiverFactoryName: assignment.receiverFactoryName.trim(),
    }
  })
  let submittedTicketSnapshot: TransferBagTicketFactSnapshot[]
  try {
    submittedTicketSnapshot = normalizeRequiredSubmittedTicketSnapshot(input.submittedTicketSnapshot)
  } catch (error) {
    return failedWholeBagHandover(error instanceof Error ? error.message : '整袋交出的完整提交快照无效。')
  }
  if (
    !sameWholeBagTicketSnapshot(ticketSnapshot, submittedTicketSnapshot)
  ) {
    return failedWholeBagHandover('提交的整袋交出快照与当前袋票关系不一致，请刷新后重试。')
  }
  if (currentUse.compatibilityBlockedReason) {
    return failedWholeBagHandover(currentUse.compatibilityBlockedReason)
  }

  return {
    ok: true,
    reason: '',
    receiverFactoryId: receiverFactoryIds[0],
    receiverFactoryName: receiverFactoryNames[0],
    sewingTaskIds: unique(assignmentsInTicketOrder.map((assignment) => assignment.sewingTaskId)),
    sewingTaskNos: unique(assignmentsInTicketOrder.map((assignment) => assignment.sewingTaskNo)),
    ticketSnapshot,
  }
}

function eventPayload(event: CuttingRuntimeEvent): Record<string, unknown> {
  return record(event.payload)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const TRANSFER_BAG_TICKET_STRING_FIELDS: Array<keyof Omit<TransferBagTicketFactSnapshot, 'pieceQty'>> = [
  'feiTicketId',
  'feiTicketNo',
  'productionOrderId',
  'productionOrderNo',
  'cutOrderId',
  'cutOrderNo',
  'color',
  'size',
  'partCode',
  'partName',
  'sewingTaskId',
  'sewingTaskNo',
  'receiverFactoryId',
  'receiverFactoryName',
]

function isCompleteTransferBagTicketSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false
  return TRANSFER_BAG_TICKET_STRING_FIELDS.every((field) =>
    typeof value[field] === 'string')
    && text(value.feiTicketId).length > 0
    && typeof value.pieceQty === 'number'
    && Number.isFinite(value.pieceQty)
}

export function parseCompleteTransferBagRepackPayload(
  event: CuttingRuntimeEvent,
): TransferBagRepackPayload | null {
  if (event.eventType !== '中转袋拆袋重装' || !isRecord(event.payload)) return null
  const payload = event.payload
  if (
    !text(payload.repackBatchId)
    || !Array.isArray(payload.sourceBags)
    || !Array.isArray(payload.resultBags)
    || !Array.isArray(payload.movedTickets)
    || !text(payload.confirmedAt)
    || !text(payload.confirmedBy)
  ) return null
  const sourceBagsComplete = payload.sourceBags.every((value) =>
    isRecord(value)
    && Boolean(text(value.bagCode))
    && Boolean(text(value.usageCycleId))
    && Array.isArray(value.beforeTickets)
    && value.beforeTickets.every(isCompleteTransferBagTicketSnapshot))
  if (!sourceBagsComplete) return null
  const resultBagsComplete = payload.resultBags.every((value) =>
    isRecord(value)
    && Boolean(text(value.bagCode))
    && Boolean(text(value.usageCycleId))
    && typeof value.reusedSourceBag === 'boolean'
    && Array.isArray(value.tickets)
    && value.tickets.every(isCompleteTransferBagTicketSnapshot))
  if (!resultBagsComplete) return null
  const movedTicketsComplete = payload.movedTickets.every((value) =>
    isRecord(value)
    && Boolean(text(value.feiTicketId))
    && Boolean(text(value.fromBagCode))
    && Boolean(text(value.toBagCode))
    && typeof value.pieceQty === 'number'
    && Number.isFinite(value.pieceQty))
  return movedTicketsComplete
    ? payload as unknown as TransferBagRepackPayload
    : null
}

function sortedRuntimeEvents(storage: BrowserStorageLike | null): CuttingRuntimeEvent[] {
  return listCuttingRuntimeEvents(storage)
    .filter((event) => event.eventStatus !== '已取消')
    .sort(compareCuttingRuntimeChronologyAscending)
}

function repackBagCodes(event: CuttingRuntimeEvent): string[] {
  const payload = parseCompleteTransferBagRepackPayload(event)
  if (!payload) return []
  return unique([
    ...payload.sourceBags.map((bag) => bag.bagCode),
    ...payload.resultBags.map((bag) => bag.bagCode),
  ])
}

export function eventTouchesTransferBag(
  event: CuttingRuntimeEvent,
  bagCode: string,
): boolean {
  const normalizedBagCode = bagCode.trim()
  if (!normalizedBagCode || event.eventStatus === '已取消') return false
  if (event.eventType === '中转袋拆袋重装') {
    return repackBagCodes(event).includes(normalizedBagCode)
  }
  const payload = eventPayload(event)
  const explicitPayloadBagCodes = [
    text(payload.bagCode),
    text(payload.transferBagCode),
    text(payload.sourceTempBagCode),
    text(payload.targetTransferBagCode),
    ...records(payload.transferBagUses).map((bag) => text(bag.bagCode)),
  ]
  return event.refs.transferBagCode === normalizedBagCode
    || event.refs.transferBagCodes?.includes(normalizedBagCode) === true
    || explicitPayloadBagCodes.includes(normalizedBagCode)
    || repackBagCodes(event).includes(normalizedBagCode)
}

function ticketSnapshot(
  raw: unknown,
  event: CuttingRuntimeEvent,
): TransferBagTicketFactSnapshot {
  const value = record(raw)
  const snapshot: TransferBagTicketFactSnapshot = {
    feiTicketId: text(value.feiTicketId),
    feiTicketNo: text(value.feiTicketNo),
    productionOrderId: text(value.productionOrderId) || event.refs.productionOrderId || '',
    productionOrderNo: text(value.productionOrderNo) || event.refs.productionOrderNo || '',
    cutOrderId: text(value.cutOrderId) || event.refs.cutOrderId || '',
    cutOrderNo: text(value.cutOrderNo) || event.refs.cutOrderNo || '',
    color: text(value.color),
    size: text(value.size),
    partCode: text(value.partCode),
    partName: text(value.partName),
    pieceQty: Number(value.pieceQty),
    sewingTaskId: text(value.sewingTaskId),
    sewingTaskNo: text(value.sewingTaskNo),
    receiverFactoryId: text(value.receiverFactoryId),
    receiverFactoryName: text(value.receiverFactoryName),
  }
  const compatibility = snapshot as TransferBagTicketFactSnapshot & Record<string, unknown>
  const optionalCompatibilityFields: Record<string, unknown> = {
    spreadingOrderId: text(value.spreadingOrderId) || event.refs.spreadingOrderId || '',
    spreadingOrderNo: text(value.spreadingOrderNo) || event.refs.spreadingOrderNo || '',
    spuCode: text(value.spuCode),
    pieceSequenceLabel: text(value.pieceSequenceLabel),
    specialCraftDisplay: text(value.specialCraftDisplay) || text(value.specialCraftCategory),
    receiverFactoryDisplay: text(value.receiverFactoryDisplay),
    printStatus: text(value.printStatus),
    voidStatus: text(value.voidStatus),
  }
  Object.entries(optionalCompatibilityFields).forEach(([key, fieldValue]) => {
    if (fieldValue) compatibility[key] = fieldValue
  })
  if ('hasSpecialCraft' in value) compatibility.hasSpecialCraft = Boolean(value.hasSpecialCraft)
  return snapshot
}

function compatibilityReasonForTickets(
  tickets: TransferBagTicketFactSnapshot[],
): string | undefined {
  if (!tickets.length) return undefined
  if (tickets.some((ticket) => !ticket.feiTicketId)) {
    return '历史袋内快照缺少可唯一识别的菲票编号，当前关系仅供核查，不能拆袋重装。'
  }
  if (tickets.some((ticket) => !ticket.productionOrderNo)) {
    return '历史袋内快照缺少生产单事实，当前关系仅供核查，不能拆袋重装。'
  }
  if (tickets.some((ticket) => !Number.isFinite(ticket.pieceQty) || ticket.pieceQty <= 0)) {
    return '历史袋内快照缺少有效片数事实，当前关系仅供核查，不能拆袋重装。'
  }
  if (tickets.some((ticket) => !ticket.receiverFactoryId)) {
    return '历史袋内快照缺少接收工厂事实，当前关系仅供核查，不能拆袋重装。'
  }
  if (tickets.some((ticket) => !ticket.sewingTaskId || !ticket.sewingTaskNo)) {
    return '历史袋内快照缺少车缝任务事实，当前关系仅供核查，不能拆袋重装。'
  }
  return undefined
}

function emptyCurrentUse(bagCode: string): TransferBagCurrentUse {
  return {
    bagCode,
    usageCycleId: null,
    productionOrderNo: '',
    tickets: [],
    mainStatus: 'IDLE',
    flowStage: null,
    latestHandoverEventId: '',
  }
}

function eventUsageCycleId(event: CuttingRuntimeEvent): string {
  return event.refs.usageCycleId || text(eventPayload(event).usageCycleId)
}

function repackBag(
  event: CuttingRuntimeEvent,
  kind: 'sourceBags' | 'resultBags',
  bagCode: string,
): TransferBagRepackPayload['sourceBags'][number]
  | TransferBagRepackPayload['resultBags'][number]
  | undefined {
  const payload = parseCompleteTransferBagRepackPayload(event)
  return payload?.[kind].find((bag) => bag.bagCode === bagCode)
}

function sameTicketQuantities(
  left: TransferBagTicketFactSnapshot[],
  right: TransferBagTicketFactSnapshot[],
): boolean {
  if (!sameStrings(left.map((ticket) => ticket.feiTicketId), right.map((ticket) => ticket.feiTicketId))) {
    return false
  }
  const rightById = new Map(right.map((ticket) => [ticket.feiTicketId, ticket.pieceQty]))
  return left.every((ticket) => rightById.get(ticket.feiTicketId) === ticket.pieceQty)
}

function resolveLegacyConfirmTickets(input: {
  event: CuttingRuntimeEvent
  eventsBefore: CuttingRuntimeEvent[]
  sourceBagCode: string
}): TransferBagTicketFactSnapshot[] | null {
  const source = resolveTransferBagCurrentUseFromEvents(
    input.sourceBagCode,
    input.eventsBefore,
    false,
  )
  const payload = eventPayload(input.event)
  const expectedIds = unique([
    ...strings(payload.containedFeiTicketIds),
    ...strings(payload.scannedFeiTicketIds),
    ...(input.event.refs.feiTicketIds || []),
  ])
  if (!source.tickets.length || !expectedIds.length) return null
  return sameStrings(source.tickets.map((ticket) => ticket.feiTicketId), expectedIds)
    ? source.tickets
    : null
}

function resolveTransferBagCurrentUseFromEvents(
  bagCode: string,
  events: CuttingRuntimeEvent[],
  allowLegacyConfirm: boolean,
): TransferBagCurrentUse {
  let state = emptyCurrentUse(bagCode)
  let hasProcessedNewRepackFact = false
  const handoverSnapshots = new Map<string, TransferBagTicketFactSnapshot[][]>()

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (!eventTouchesTransferBag(event, bagCode)) continue
    if (state.mainStatus === 'DISABLED') continue
    const payload = eventPayload(event)

    if (event.eventType === '菲票装袋') {
      const tickets = records(payload.feiTicketItems).map((item) => ticketSnapshot(item, event))
      state = {
        ...state,
        usageCycleId: eventUsageCycleId(event) || `usage:${bagCode}:${event.eventId}`,
        productionOrderNo: unique(tickets.map((ticket) => ticket.productionOrderNo))[0] || '',
        tickets,
        mainStatus: 'IN_USE',
        flowStage: 'PACKED',
        compatibilityBlockedReason: compatibilityReasonForTickets(tickets),
      }
      continue
    }

    if (event.eventType === '中转袋入仓') {
      const inboundTickets = records(payload.feiTicketItems).map((item) => ticketSnapshot(item, event))
      const quantityChanged = inboundTickets.length > 0
        && state.tickets.length > 0
        && !sameTicketQuantities(state.tickets, inboundTickets)
      state = {
        ...state,
        usageCycleId: eventUsageCycleId(event) || state.usageCycleId,
        mainStatus: 'IN_USE',
        flowStage: 'INBOUND_STORED',
        ...(quantityChanged
          ? { compatibilityBlockedReason: '入仓快照与当前装袋快照的菲票或片数不一致，不能拆袋重装。' }
          : {}),
      }
      continue
    }

    if (event.eventType === '中转袋拆袋重装') {
      const result = repackBag(event, 'resultBags', bagCode)
      if (result) {
        const tickets = records(result.tickets).map((item) => ticketSnapshot(item, event))
        state = {
          ...state,
          usageCycleId: text(result.usageCycleId) || null,
          productionOrderNo: unique(tickets.map((ticket) => ticket.productionOrderNo))[0] || '',
          tickets,
          mainStatus: 'IN_USE',
          flowStage: 'READY_HANDOVER',
          compatibilityBlockedReason: compatibilityReasonForTickets(tickets),
        }
      } else if (repackBag(event, 'sourceBags', bagCode)) {
        state = emptyCurrentUse(bagCode)
      }
      hasProcessedNewRepackFact = true
      continue
    }

    if (allowLegacyConfirm && event.eventType === '交出装袋确认') {
      if (hasProcessedNewRepackFact) continue
      const sourceBagCode = text(payload.sourceTempBagCode)
      const targetBagCode = text(payload.targetTransferBagCode)
      const recovered = sourceBagCode && targetBagCode
        ? resolveLegacyConfirmTickets({
            event,
            eventsBefore: events.slice(0, index),
            sourceBagCode,
          })
        : null
      if (!recovered) {
        state = {
          ...state,
          compatibilityBlockedReason: '旧交出装袋确认无法唯一恢复来源袋和结果袋的当前菲票关系，未建立猜测绑定。',
        }
      } else if (bagCode === targetBagCode) {
        state = {
          ...state,
          usageCycleId: eventUsageCycleId(event) || state.usageCycleId,
          productionOrderNo: unique(recovered.map((ticket) => ticket.productionOrderNo))[0] || '',
          tickets: recovered,
          mainStatus: 'IN_USE',
          flowStage: 'READY_HANDOVER',
          compatibilityBlockedReason: compatibilityReasonForTickets(recovered),
        }
      } else if (bagCode === sourceBagCode) {
        state = emptyCurrentUse(bagCode)
      }
      continue
    }

    if (event.eventType === '新增交出记录' || event.eventType === '特殊工艺交出') {
      const handoverRecordId = event.refs.handoverRecordId || text(payload.handoverRecordId)
      if (handoverRecordId && state.tickets.length) {
        const snapshots = handoverSnapshots.get(handoverRecordId) || []
        snapshots.push(state.tickets)
        handoverSnapshots.set(handoverRecordId, snapshots)
      }
      state = {
        ...state,
        tickets: [],
        mainStatus: 'IN_USE',
        flowStage: 'HANDED_OVER_WAITING_RETURN',
        latestHandoverEventId: event.eventId,
      }
      continue
    }

    if (event.eventType === '特殊工艺回仓') {
      const sourceHandoverRecordId = text(payload.sourceHandoverRecordId) || event.refs.handoverRecordId || ''
      const candidates = handoverSnapshots.get(sourceHandoverRecordId) || []
      if (candidates.length === 1) {
        const tickets = candidates[0]
        state = {
          ...state,
          productionOrderNo: unique(tickets.map((ticket) => ticket.productionOrderNo))[0] || state.productionOrderNo,
          tickets,
          mainStatus: 'IN_USE',
          flowStage: 'INBOUND_STORED',
          compatibilityBlockedReason: compatibilityReasonForTickets(tickets),
        }
      } else {
        state = {
          ...state,
          compatibilityBlockedReason: '特殊工艺回仓无法唯一识别原交出袋内快照，未恢复猜测关系。',
        }
      }
      continue
    }

    if (event.eventType === '中转袋回收') {
      const validRecovery = (
        payload.physicalBagReceived === true
        && payload.physicalBagEmpty === true
      ) || Boolean(text(payload.returnWarehouseName))
      if (validRecovery) state = emptyCurrentUse(bagCode)
      continue
    }

    if (event.eventType === '中转袋报废') {
      if (state.mainStatus === 'IDLE' && state.tickets.length === 0) {
        state = {
          ...emptyCurrentUse(bagCode),
          mainStatus: 'DISABLED',
        }
      }
    }
  }
  return state
}

export function resolveTransferBagCurrentUse(
  bagCode: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): TransferBagCurrentUse {
  const normalizedBagCode = bagCode.trim()
  if (!normalizedBagCode) return emptyCurrentUse('')
  return resolveTransferBagCurrentUseFromEvents(
    normalizedBagCode,
    sortedRuntimeEvents(storage),
    true,
  )
}

function assertUniqueNonEmpty(values: string[], label: string): string[] {
  const normalized = values.map((value) => value.trim())
  if (normalized.some((value) => !value)) throw new Error(`${label}不能为空。`)
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label}必须唯一，不能重复。`)
  return normalized
}

function normalizeSubmitTransferBagRepackInput(
  input: SubmitTransferBagRepackInput,
  repackBatchId: string,
): SubmitTransferBagRepackInput {
  const sourceBagCodes = assertUniqueNonEmpty(input.sourceBagCodes, '来源袋编号')
  const results = input.results.map((result) => {
    const bagCode = result.bagCode.trim()
    const feiTicketIds = assertUniqueNonEmpty(
      result.feiTicketIds,
      `${bagCode || '结果袋'} 的菲票编号`,
    )
    return { bagCode, feiTicketIds }
  })
  assertUniqueNonEmpty(results.map((result) => result.bagCode), '结果袋编号')
  const resultTicketIds = results.flatMap((result) => result.feiTicketIds)
  const duplicateAcrossResults = resultTicketIds.find((feiTicketId, index) =>
    resultTicketIds.indexOf(feiTicketId) !== index)
  if (duplicateAcrossResults) {
    throw new Error(`菲票 ${duplicateAcrossResults} 跨结果袋重复，全部来源菲票必须恰好出现一次。`)
  }
  return {
    repackBatchId,
    sourceBagCodes,
    results,
    operator: {
      operatorId: input.operator.operatorId?.trim(),
      operatorName: input.operator.operatorName.trim(),
      operatorRole: input.operator.operatorRole?.trim(),
    },
    source: input.source,
    occurredAt: input.occurredAt?.trim(),
  }
}

function canonicalRepackIntent(input: {
  sourceBagCodes: string[]
  results: Array<{ bagCode: string; feiTicketIds: string[] }>
}): string {
  return JSON.stringify({
    sourceBagCodes: input.sourceBagCodes.map((bagCode) => bagCode.trim()).sort(),
    results: input.results
      .map((result) => ({
        bagCode: result.bagCode.trim(),
        feiTicketIds: result.feiTicketIds.map((feiTicketId) => feiTicketId.trim()).sort(),
      }))
      .sort((left, right) => left.bagCode.localeCompare(right.bagCode, 'zh-CN')),
  })
}

function existingRepackIntent(event: CuttingRuntimeEvent): string {
  const payload = eventPayload(event)
  return canonicalRepackIntent({
    sourceBagCodes: records(payload.sourceBags).map((bag) => text(bag.bagCode)),
    results: records(payload.resultBags).map((bag) => ({
      bagCode: text(bag.bagCode),
      feiTicketIds: records(bag.tickets).map((ticket) => text(ticket.feiTicketId)),
    })),
  })
}

function assertRepackSourceTicketComplete(ticket: TransferBagTicketFactSnapshot): void {
  if (!ticket.feiTicketId) throw new Error('来源袋存在无法唯一识别的菲票，不能拆袋重装。')
  if (!ticket.productionOrderNo) throw new Error(`${ticket.feiTicketNo || ticket.feiTicketId} 缺少生产单事实，不能拆袋重装。`)
  if (!Number.isFinite(ticket.pieceQty) || ticket.pieceQty <= 0) {
    throw new Error(`${ticket.feiTicketNo || ticket.feiTicketId} 缺少有效片数，不能拆袋重装。`)
  }
  if (!ticket.receiverFactoryId) {
    throw new Error(`${ticket.feiTicketNo || ticket.feiTicketId} 缺少接收工厂分配，不能拆袋重装。`)
  }
}

export function submitTransferBagRepack(
  input: SubmitTransferBagRepackInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<'中转袋拆袋重装'> {
  const repackBatchId = input.repackBatchId.trim()
  if (!repackBatchId) throw new Error('重装批次编号不能为空。')
  const normalizedInput = normalizeSubmitTransferBagRepackInput(input, repackBatchId)
  const idempotencyKey = `transfer-bag-repack:${repackBatchId}`
  const existing = listCuttingRuntimeEvents(storage).find((event) =>
    event.eventStatus !== '已取消'
    && event.eventType === '中转袋拆袋重装'
    && (
      event.idempotencyKey === idempotencyKey
      || event.refs.repackBatchId?.trim() === repackBatchId
      || text(eventPayload(event).repackBatchId) === repackBatchId
    ))
  if (existing) {
    if (existingRepackIntent(existing) !== canonicalRepackIntent(normalizedInput)) {
      throw new Error('重装批次已存在且请求内容不一致。')
    }
    return existing as CuttingRuntimeEvent<'中转袋拆袋重装'>
  }

  const sourceBagCodes = normalizedInput.sourceBagCodes
  if (!sourceBagCodes.length) throw new Error('来源袋编号不能为空。')
  const sourceUses = sourceBagCodes.map((bagCode) => resolveTransferBagCurrentUse(bagCode, storage))
  const allowedSourceStages = new Set<TransferBagFlowStageKey>([
    'PACKED',
    'INBOUND_STORED',
    'READY_HANDOVER',
  ])
  for (const source of sourceUses) {
    if (!source.flowStage || !allowedSourceStages.has(source.flowStage)) {
      throw new Error(`${source.bagCode} 当前阶段不是菲票已装袋、入仓暂存中或待交出，不能作为重装来源袋。`)
    }
    if (!source.tickets.length) throw new Error(`${source.bagCode} 没有当前菲票，不能作为重装来源袋。`)
    if (source.compatibilityBlockedReason) throw new Error(source.compatibilityBlockedReason)
    source.tickets.forEach(assertRepackSourceTicketComplete)
  }

  const resultBagCodes = normalizedInput.results.map((result) => result.bagCode)
  if (!resultBagCodes.length) throw new Error('结果袋不能为空。')
  normalizedInput.results.forEach((result) => {
    if (!result.feiTicketIds.length) throw new Error(`${result.bagCode} 至少需要一张菲票。`)
  })

  const sourceTickets = sourceUses.flatMap((source) =>
    source.tickets.map((ticket) => ({ ticket, fromBagCode: source.bagCode })))
  const sourceTicketIds = sourceTickets.map(({ ticket }) => ticket.feiTicketId)
  if (new Set(sourceTicketIds).size !== sourceTicketIds.length) {
    throw new Error('来源袋当前关系中存在重复菲票，不能拆袋重装。')
  }
  const resultTicketIds = normalizedInput.results.flatMap((result) => result.feiTicketIds)
  const duplicateResultTicketId = resultTicketIds.find((id, index) => resultTicketIds.indexOf(id) !== index)
  if (duplicateResultTicketId) {
    throw new Error(`菲票 ${duplicateResultTicketId} 在结果袋中重复，全部来源菲票必须恰好出现一次。`)
  }
  const missingTicketIds = sourceTicketIds.filter((id) => !resultTicketIds.includes(id))
  if (missingTicketIds.length) throw new Error(`结果袋缺失来源菲票：${missingTicketIds.join('、')}。`)
  const extraTicketIds = resultTicketIds.filter((id) => !sourceTicketIds.includes(id))
  if (extraTicketIds.length) throw new Error(`结果袋包含非来源菲票：${extraTicketIds.join('、')}。`)

  const sourceTicketById = new Map(sourceTickets.map((item) => [item.ticket.feiTicketId, item]))
  for (const result of normalizedInput.results) {
    const resultTickets = result.feiTicketIds.map((id) => sourceTicketById.get(id)!.ticket)
    if (unique(resultTickets.map((ticket) => ticket.productionOrderNo)).length !== 1) {
      throw new Error(`${result.bagCode} 结果袋只能装入同一生产单的菲票。`)
    }
    if (unique(resultTickets.map((ticket) => ticket.receiverFactoryId)).length !== 1) {
      throw new Error(`${result.bagCode} 结果袋的菲票必须对应同一接收工厂。`)
    }
  }

  for (const resultBagCode of resultBagCodes) {
    if (sourceBagCodes.includes(resultBagCode)) continue
    const resultUse = resolveTransferBagCurrentUse(resultBagCode, storage)
    if (resultUse.mainStatus === 'DISABLED') throw new Error(`${resultBagCode} 已报废，不能作为结果袋。`)
    if (resultUse.mainStatus !== 'IDLE') {
      throw new Error(`${resultBagCode} 是无关的使用中袋，不能作为结果袋。`)
    }
  }

  const resultBags: TransferBagRepackPayload['resultBags'] = normalizedInput.results.map((result) => {
    const tickets = result.feiTicketIds.map((id) => sourceTicketById.get(id)!.ticket)
    const sourceUse = sourceUses.find((source) => source.bagCode === result.bagCode)
    const productionOrderNo = tickets[0]?.productionOrderNo || ''
    const usageCycleId = sourceUse?.productionOrderNo === productionOrderNo
      ? sourceUse.usageCycleId || `usage:${result.bagCode}:${repackBatchId}`
      : `usage:${result.bagCode}:${repackBatchId}`
    return {
      bagCode: result.bagCode,
      usageCycleId,
      reusedSourceBag: Boolean(sourceUse),
      tickets,
    }
  })
  const sourceBags: TransferBagRepackPayload['sourceBags'] = sourceUses.map((source) => ({
    bagCode: source.bagCode,
    usageCycleId: source.usageCycleId || '',
    beforeTickets: source.tickets,
  }))
  const movedTickets: TransferBagRepackPayload['movedTickets'] = resultBags.flatMap((result) =>
    result.tickets.map((ticket) => ({
      feiTicketId: ticket.feiTicketId,
      fromBagCode: sourceTicketById.get(ticket.feiTicketId)!.fromBagCode,
      toBagCode: result.bagCode,
      pieceQty: ticket.pieceQty,
    })))
  const occurredAt = normalizedInput.occurredAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
  const payload: TransferBagRepackPayload = {
    repackBatchId,
    sourceBags,
    resultBags,
    movedTickets,
    confirmedAt: occurredAt,
    confirmedBy: normalizedInput.operator.operatorName,
  }
  return appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '中转袋拆袋重装',
    eventSource: normalizedInput.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: normalizedInput.operator.operatorId,
    operatorName: normalizedInput.operator.operatorName,
    operatorRole: normalizedInput.operator.operatorRole || '裁片仓重装员',
    refs: {
      repackBatchId,
      transferBagCodes: unique([...sourceBagCodes, ...resultBagCodes]),
      feiTicketIds: sourceTickets.map(({ ticket }) => ticket.feiTicketId),
      feiTicketNos: sourceTickets.map(({ ticket }) => ticket.feiTicketNo),
      sewingTaskIds: unique(sourceTickets.map(({ ticket }) => ticket.sewingTaskId)),
      sewingTaskNos: unique(sourceTickets.map(({ ticket }) => ticket.sewingTaskNo)),
    },
    payload,
  }, storage).event
}

function wholeBagHandoverSourceLocation(input: {
  currentUse: TransferBagCurrentUse
  events: CuttingRuntimeEvent[]
}): {
  warehouseArea: string
  locationCode: string
  locationRef?: RuntimeWarehouseLocationRef
} {
  if (input.currentUse.flowStage === 'READY_HANDOVER') {
    return {
      warehouseArea: '待交出操作区',
      locationCode: '待交出操作区',
    }
  }
  const inboundEvent = input.events
    .filter((event) =>
      event.eventType === '中转袋入仓'
      && eventTouchesTransferBag(event, input.currentUse.bagCode)
      && (
        !input.currentUse.usageCycleId
        || !eventUsageCycleId(event)
        || eventUsageCycleId(event) === input.currentUse.usageCycleId
      ))
    .at(-1)
  const payload = inboundEvent ? eventPayload(inboundEvent) : {}
  const warehouseArea = text(payload.warehouseArea)
    || inboundEvent?.inventoryEffect?.toWarehouseArea?.trim()
    || ''
  const locationCode = text(payload.locationCode)
    || inboundEvent?.inventoryEffect?.toLocationCode?.trim()
    || ''
  if (!warehouseArea || !locationCode) {
    throw new Error('入仓暂存中的中转袋缺少真实待交出仓库区或库位，不能整袋交出。')
  }
  const rawLocationRef = record(payload.locationRef)
  const locationRef = text(rawLocationRef.locationId) && text(rawLocationRef.locationNo)
    ? { ...rawLocationRef } as unknown as RuntimeWarehouseLocationRef
    : undefined
  return { warehouseArea, locationCode, locationRef }
}

function requiredHandoverText(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${label}不能为空。`)
  return normalized
}

function buildWholeBagHandoverCanonicalIntent(input: {
  bagCode: string
  usageCycleId: string
  handoverOrderId: string
  handoverOrderNo: string
  handoverRecordId: string
  handoverRecordNo: string
  assignments: FeiTicketSewingAssignment[]
  submittedTicketSnapshot: TransferBagTicketFactSnapshot[]
  source: CuttingRuntimeEventSource
  operator: TransferBagRuntimeOperator
}): string {
  const assignments = input.assignments
    .map((item) => ({ ...item }))
    .sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId))
  const submittedTicketSnapshot = input.submittedTicketSnapshot
    .map((item) => ({ ...item }))
    .sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId))
  return JSON.stringify({
    bagCode: input.bagCode,
    usageCycleId: input.usageCycleId,
    handoverOrderId: input.handoverOrderId,
    handoverOrderNo: input.handoverOrderNo,
    handoverRecordId: input.handoverRecordId,
    handoverRecordNo: input.handoverRecordNo,
    assignments,
    submittedTicketSnapshot,
    source: input.source,
    operator: {
      operatorId: text(input.operator.operatorId),
      operatorName: text(input.operator.operatorName),
      operatorRole: text(input.operator.operatorRole) || '裁片仓交出员',
    },
  })
}

function findSuccessfulWholeBagHandoverByRecordId(
  events: CuttingRuntimeEvent[],
  handoverRecordId: string,
): CuttingRuntimeEvent<'新增交出记录'> | undefined {
  return events.find((event) =>
    event.eventType === '新增交出记录'
    && (event.eventStatus === '已记录' || event.eventStatus === '已同步')
    && (
      text(event.refs.handoverRecordId) === handoverRecordId
      || text(eventPayload(event).handoverRecordId) === handoverRecordId
    )) as CuttingRuntimeEvent<'新增交出记录'> | undefined
}

export function submitWholeBagHandover(
  input: SubmitWholeBagHandoverInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<'新增交出记录'> {
  const bagCode = requiredHandoverText(input.bagCode, '中转袋编号')
  const usageCycleId = requiredHandoverText(input.usageCycleId, '中转袋使用周期')
  const handoverOrderId = requiredHandoverText(input.handoverOrderId, '交出单 ID')
  const handoverOrderNo = requiredHandoverText(input.handoverOrderNo, '交出单号')
  const handoverRecordId = requiredHandoverText(input.handoverRecordId, '交出记录 ID')
  const handoverRecordNo = requiredHandoverText(input.handoverRecordNo, '交出记录号')
  const submittedBy = requiredHandoverText(input.operator.operatorName, '交出人')
  const occurredAt = input.occurredAt?.trim()
    || new Date().toISOString().slice(0, 16).replace('T', ' ')
  const events = sortedRuntimeEvents(storage)
  const existingRecord = findSuccessfulWholeBagHandoverByRecordId(events, handoverRecordId)
  if (existingRecord) {
    let retryCanonicalIntent = ''
    try {
      retryCanonicalIntent = buildWholeBagHandoverCanonicalIntent({
        bagCode,
        usageCycleId,
        handoverOrderId,
        handoverOrderNo,
        handoverRecordId,
        handoverRecordNo,
        assignments: normalizeRequiredAssignments(input.assignments),
        submittedTicketSnapshot: normalizeRequiredSubmittedTicketSnapshot(input.submittedTicketSnapshot),
        source: input.source,
        operator: input.operator,
      })
    } catch {
      throw new Error(`交出记录 ID ${handoverRecordId} 已存在，但本次请求业务意图冲突。`)
    }
    if (text(eventPayload(existingRecord).canonicalIntent) === retryCanonicalIntent) {
      return existingRecord
    }
    throw new Error(`交出记录 ID ${handoverRecordId} 已存在，但本次请求业务意图冲突。`)
  }
  const currentUse = resolveTransferBagCurrentUse(bagCode, storage)
  const eligibility = resolveWholeBagHandoverEligibility({
    currentUse,
    assignments: input.assignments,
    existingHandoverEvents: events,
    submittedTicketSnapshot: input.submittedTicketSnapshot,
  })
  if (!eligibility.ok) throw new Error(eligibility.reason)
  if (!currentUse.usageCycleId) {
    throw new Error('当前中转袋缺少使用周期，不能整袋交出。')
  }
  if (currentUse.usageCycleId !== usageCycleId) {
    throw new Error('提交的中转袋使用周期与当前袋票关系不一致，请刷新后重试。')
  }
  const assignments = normalizeRequiredAssignments(input.assignments)
  const submittedTicketSnapshot = normalizeRequiredSubmittedTicketSnapshot(input.submittedTicketSnapshot)
  const canonicalIntent = buildWholeBagHandoverCanonicalIntent({
    bagCode,
    usageCycleId,
    handoverOrderId,
    handoverOrderNo,
    handoverRecordId,
    handoverRecordNo,
    assignments,
    submittedTicketSnapshot,
    source: input.source,
    operator: input.operator,
  })
  const sourceLocation = wholeBagHandoverSourceLocation({ currentUse, events })
  const ticketSnapshot = eligibility.ticketSnapshot.map((ticket) => ({ ...ticket }))
  const totalPieceQty = ticketSnapshot.reduce((sum, ticket) => sum + ticket.pieceQty, 0)
  const transferBagUse: WholeBagHandoverSubmitPayload['transferBagUses'][0] = {
    bagUseId: currentUse.usageCycleId,
    bagCode,
    containedFeiTicketIds: ticketSnapshot.map((ticket) => ticket.feiTicketId),
    totalPieceQty,
    sewingTaskIds: [...eligibility.sewingTaskIds],
    sewingTaskNos: [...eligibility.sewingTaskNos],
    ticketSnapshot,
    sourceWarehouseArea: sourceLocation.warehouseArea,
    sourceLocationCode: sourceLocation.locationCode,
    ...(sourceLocation.locationRef
      ? { sourceLocationRef: { ...sourceLocation.locationRef } }
      : {}),
  }
  const payload: WholeBagHandoverSubmitPayload = {
    canonicalIntent,
    handoverOrderId,
    handoverOrderNo,
    handoverRecordId,
    handoverRecordNo,
    receiverType: '车缝厂',
    receiverId: eligibility.receiverFactoryId,
    receiverName: eligibility.receiverFactoryName,
    transferBagUses: [transferBagUse],
    feiTicketItems: ticketSnapshot.map((ticket) => ({
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      pieceQty: ticket.pieceQty,
      unit: '片',
    })),
    currentHandedOverQty: totalPieceQty,
    submittedAt: occurredAt,
    submittedBy,
  }
  const handoverLegId = `${currentUse.usageCycleId}:handover:1`
  return appendCuttingRuntimeEventIdempotent({
    idempotencyKey: `whole-bag-handover:${handoverRecordId}`,
    eventType: '新增交出记录',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId?.trim(),
    operatorName: submittedBy,
    operatorRole: input.operator.operatorRole?.trim() || '裁片仓交出员',
    refs: {
      productionOrderId: ticketSnapshot[0].productionOrderId,
      productionOrderNo: ticketSnapshot[0].productionOrderNo,
      transferBagCode: bagCode,
      usageCycleId: currentUse.usageCycleId,
      handoverOrderId,
      handoverRecordId,
      handoverLegId,
      feiTicketIds: ticketSnapshot.map((ticket) => ticket.feiTicketId),
      feiTicketNos: ticketSnapshot.map((ticket) => ticket.feiTicketNo),
      sewingTaskIds: [...eligibility.sewingTaskIds],
      sewingTaskNos: [...eligibility.sewingTaskNos],
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'OUT',
      qty: totalPieceQty,
      unit: '片',
      fromWarehouseArea: sourceLocation.warehouseArea,
      fromLocationCode: sourceLocation.locationCode,
    },
    payload,
  }, storage).event
}
