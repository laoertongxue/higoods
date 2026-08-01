import {
  appendCuttingRuntimeEventIdempotent,
  buildCuttingRuntimeEventId,
  listCuttingRuntimeEvents,
  type CuttingRuntimeEvent,
  type CuttingRuntimeEventSource,
  type CompleteSpecialCraftHandoverPayload,
  type RuntimeWarehouseLocationRef,
  type TransferBagRecoveryPayload,
  type TransferBagRepackPayload,
  type TransferBagScrapPayload,
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

export interface RecoverTransferBagInput {
  bagCode: string
  physicalBagReceived: boolean
  physicalBagEmpty: boolean
  recoveryMode: 'NORMAL' | 'FORCED'
  recoveryNode: string
  recoveryLocation: string
  reason: string
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}

export interface ScrapTransferBagInput {
  bagCode: string
  reason: string
  authorizedBy: string
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

const CUTTING_RUNTIME_EVENT_SOURCES: CuttingRuntimeEventSource[] = [
  'PDA',
  'WEB',
  'MOCK',
  'WMS',
]

function requiredText(value: unknown, label: string): string {
  const normalized = text(value)
  if (!normalized) throw new Error(`${label}必填。`)
  return normalized
}

function requiredEventSource(
  value: unknown,
  label: string,
): CuttingRuntimeEventSource {
  if (!CUTTING_RUNTIME_EVENT_SOURCES.includes(value as CuttingRuntimeEventSource)) {
    throw new Error(`${label}无效。`)
  }
  return value as CuttingRuntimeEventSource
}

function normalizedOperator(
  value: unknown,
  label: string,
  defaultRole: string,
): TransferBagRuntimeOperator {
  const source = record(value)
  return {
    operatorId: text(source.operatorId) || undefined,
    operatorName: requiredText(source.operatorName, label),
    operatorRole: text(source.operatorRole) || defaultRole,
  }
}

function cloneRuntimeEvent<T extends CuttingRuntimeEvent['eventType']>(
  event: CuttingRuntimeEvent<T>,
): CuttingRuntimeEvent<T> {
  return JSON.parse(JSON.stringify(event)) as CuttingRuntimeEvent<T>
}

function isSuccessfulRuntimeEvent(event: CuttingRuntimeEvent): boolean {
  return event.eventStatus === '已记录' || event.eventStatus === '已同步'
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
    const wholeBagHandover = parseStrictWholeBagHandoverEvent(event)
    return Boolean(
      wholeBagHandover
      && wholeBagHandover.bagCode === currentUse.bagCode
      && currentUse.usageCycleId
      && wholeBagHandover.usageCycleId === currentUse.usageCycleId,
    )
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
  const legacyAssignmentCanBeCompleted = currentUse.compatibilityBlockedReason === '历史袋内快照缺少接收工厂事实，当前关系仅供核查，不能拆袋重装。'
    || currentUse.compatibilityBlockedReason === '历史袋内快照缺少车缝任务事实，当前关系仅供核查，不能拆袋重装。'
  if (currentUse.compatibilityBlockedReason && !legacyAssignmentCanBeCompleted) {
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

type NormalizedRecoverTransferBagInput = Omit<
  RecoverTransferBagInput,
  'operator' | 'occurredAt'
> & {
  operator: TransferBagRuntimeOperator
  occurredAt: string
}

type NormalizedScrapTransferBagInput = Omit<
  ScrapTransferBagInput,
  'operator' | 'occurredAt'
> & {
  operator: TransferBagRuntimeOperator
  occurredAt: string
}

function canonicalRecoveryIntent(
  input: Omit<NormalizedRecoverTransferBagInput, 'occurredAt'>,
  usageCycleId: string,
): string {
  return JSON.stringify({
    bagCode: input.bagCode,
    usageCycleId,
    physicalBagReceived: input.physicalBagReceived,
    physicalBagEmpty: input.physicalBagEmpty,
    recoveryMode: input.recoveryMode,
    recoveryNode: input.recoveryNode,
    recoveryLocation: input.recoveryLocation,
    reason: input.reason,
    source: input.source,
    operator: input.operator,
  })
}

function canonicalScrapIntent(
  input: Omit<NormalizedScrapTransferBagInput, 'occurredAt'>,
): string {
  return JSON.stringify({
    bagCode: input.bagCode,
    reason: input.reason,
    authorizedBy: input.authorizedBy,
    source: input.source,
    operator: input.operator,
  })
}

function parseCompleteRecoveryEvent(event: CuttingRuntimeEvent): {
  event: CuttingRuntimeEvent<'中转袋回收'>
  payload: TransferBagRecoveryPayload
  canonicalIntent: string
} | null {
  if (event.eventType !== '中转袋回收' || !isSuccessfulRuntimeEvent(event)) return null
  const payload = eventPayload(event)
  const bagCode = text(payload.bagCode)
  const usageCycleId = text(payload.usageCycleId)
  const recoveryMode = payload.recoveryMode
  const recoveryNode = text(payload.recoveryNode)
  const recoveryLocation = text(payload.recoveryLocation)
  const reason = text(payload.reason)
  const recoveredAt = text(payload.recoveredAt)
  const recoveredBy = text(payload.recoveredBy)
  const operatorName = text(event.operatorName)
  const source = event.eventSource
  if (
    !bagCode
    || !usageCycleId
    || payload.physicalBagReceived !== true
    || payload.physicalBagEmpty !== true
    || (recoveryMode !== 'NORMAL' && recoveryMode !== 'FORCED')
    || !recoveryNode
    || !recoveryLocation
    || (recoveryMode === 'FORCED' && !reason)
    || !recoveredAt
    || !recoveredBy
    || recoveredAt !== event.occurredAt
    || recoveredBy !== operatorName
    || event.refs.transferBagCode !== bagCode
    || event.refs.usageCycleId !== usageCycleId
    || !CUTTING_RUNTIME_EVENT_SOURCES.includes(source)
    || !operatorName
  ) return null
  const operator: TransferBagRuntimeOperator = {
    operatorId: text(event.operatorId) || undefined,
    operatorName,
    operatorRole: text(event.operatorRole) || '中转袋回收员',
  }
  const normalizedPayload: TransferBagRecoveryPayload = {
    bagCode,
    usageCycleId,
    physicalBagReceived: true,
    physicalBagEmpty: true,
    recoveryMode,
    recoveryNode,
    recoveryLocation,
    reason,
    recoveredAt,
    recoveredBy,
  }
  return {
    event: event as CuttingRuntimeEvent<'中转袋回收'>,
    payload: normalizedPayload,
    canonicalIntent: canonicalRecoveryIntent({
      bagCode,
      physicalBagReceived: true,
      physicalBagEmpty: true,
      recoveryMode,
      recoveryNode,
      recoveryLocation,
      reason,
      operator,
      source,
    }, usageCycleId),
  }
}

function parseCompleteScrapEvent(event: CuttingRuntimeEvent): {
  event: CuttingRuntimeEvent<'中转袋报废'>
  payload: TransferBagScrapPayload
  canonicalIntent: string
} | null {
  if (event.eventType !== '中转袋报废' || !isSuccessfulRuntimeEvent(event)) return null
  const payload = eventPayload(event)
  const bagCode = text(payload.bagCode)
  const reason = text(payload.reason)
  const authorizedBy = text(payload.authorizedBy)
  const scrappedAt = text(payload.scrappedAt)
  const scrappedBy = text(payload.scrappedBy)
  const operatorName = text(event.operatorName)
  const source = event.eventSource
  if (
    !bagCode
    || payload.idleConfirmed !== true
    || !reason
    || !authorizedBy
    || !scrappedAt
    || !scrappedBy
    || scrappedAt !== event.occurredAt
    || scrappedBy !== operatorName
    || event.refs.transferBagCode !== bagCode
    || !CUTTING_RUNTIME_EVENT_SOURCES.includes(source)
    || !operatorName
  ) return null
  const operator: TransferBagRuntimeOperator = {
    operatorId: text(event.operatorId) || undefined,
    operatorName,
    operatorRole: text(event.operatorRole) || '中转袋主管',
  }
  const normalizedPayload: TransferBagScrapPayload = {
    bagCode,
    idleConfirmed: true,
    reason,
    authorizedBy,
    scrappedAt,
    scrappedBy,
  }
  return {
    event: event as CuttingRuntimeEvent<'中转袋报废'>,
    payload: normalizedPayload,
    canonicalIntent: canonicalScrapIntent({
      bagCode,
      reason,
      authorizedBy,
      operator,
      source,
    }),
  }
}

function isCompleteLegacyRecoveryEvent(
  event: CuttingRuntimeEvent,
  bagCode: string,
  usageCycleId: string | null,
): boolean {
  if (
    event.eventType !== '中转袋回收'
    || !isSuccessfulRuntimeEvent(event)
    || !usageCycleId
  ) return false
  const payload = eventPayload(event)
  return text(payload.bagCode) === bagCode
    && text(payload.usageCycleId) === usageCycleId
    && event.refs.transferBagCode === bagCode
    && event.refs.usageCycleId === usageCycleId
    && Boolean(text(payload.returnWarehouseName))
    && Boolean(text(payload.returnedAt))
    && Boolean(text(payload.returnedBy))
}

function isCompleteLegacyScrapEvent(
  event: CuttingRuntimeEvent,
  bagCode: string,
): boolean {
  if (event.eventType !== '中转袋报废' || !isSuccessfulRuntimeEvent(event)) return false
  const payload = eventPayload(event)
  return text(payload.bagCode) === bagCode
    && event.refs.transferBagCode === bagCode
    && Boolean(text(payload.reason))
    && Boolean(text(payload.scrappedAt))
    && Boolean(text(payload.scrappedBy))
}

export function isCompleteSuccessfulTransferBagRecoveryEvent(
  event: CuttingRuntimeEvent,
): boolean {
  if (parseCompleteRecoveryEvent(event)) return true
  const payload = eventPayload(event)
  const bagCode = text(payload.bagCode)
  const usageCycleId = text(payload.usageCycleId)
  return isCompleteLegacyRecoveryEvent(event, bagCode, usageCycleId || null)
}

export function isCompleteSuccessfulTransferBagScrapEvent(
  event: CuttingRuntimeEvent,
): boolean {
  const bagCode = text(eventPayload(event).bagCode)
  return Boolean(parseCompleteScrapEvent(event))
    || isCompleteLegacyScrapEvent(event, bagCode)
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

    if (event.eventType === '新增交出记录') {
      const wholeBagHandover = parseStrictWholeBagHandoverEvent(event)
      if (
        !wholeBagHandover
        || wholeBagHandover.bagCode !== bagCode
        || !state.usageCycleId
        || wholeBagHandover.usageCycleId !== state.usageCycleId
      ) {
        continue
      }
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

    if (event.eventType === '特殊工艺交出') {
      const specialCraftHandover = parseStrictSpecialCraftHandoverEvent(event)
      if (
        !specialCraftHandover
        || specialCraftHandover.bagCode !== bagCode
        || !state.usageCycleId
        || specialCraftHandover.usageCycleId !== state.usageCycleId
      ) continue
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
      const recovery = parseCompleteRecoveryEvent(event)
      const matchesCurrentCycle = Boolean(
        state.usageCycleId
        && (
          recovery?.payload.usageCycleId === state.usageCycleId
          || isCompleteLegacyRecoveryEvent(event, bagCode, state.usageCycleId)
        ),
      )
      if (
        state.flowStage === 'HANDED_OVER_WAITING_RETURN'
        && matchesCurrentCycle
      ) state = emptyCurrentUse(bagCode)
      continue
    }

    if (event.eventType === '中转袋报废') {
      const validScrap = Boolean(parseCompleteScrapEvent(event))
        || isCompleteLegacyScrapEvent(event, bagCode)
      if (
        validScrap
        && state.mainStatus === 'IDLE'
        && state.tickets.length === 0
      ) {
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

function normalizeRecoverTransferBagInput(
  input: RecoverTransferBagInput,
): NormalizedRecoverTransferBagInput {
  const source = record(input)
  const bagCode = requiredText(source.bagCode, '中转袋编号')
  if (source.physicalBagReceived !== true) {
    throw new Error('请确认实物袋已经收到。')
  }
  if (source.physicalBagEmpty !== true) {
    throw new Error('请确认实物袋为空。')
  }
  const recoveryMode = source.recoveryMode
  if (recoveryMode !== 'NORMAL' && recoveryMode !== 'FORCED') {
    throw new Error('回收方式无效。')
  }
  const reason = text(source.reason)
  if (recoveryMode === 'FORCED' && !reason) {
    throw new Error('强制回收必须填写原因。')
  }
  return {
    bagCode,
    physicalBagReceived: true,
    physicalBagEmpty: true,
    recoveryMode,
    recoveryNode: requiredText(source.recoveryNode, '回收节点'),
    recoveryLocation: requiredText(source.recoveryLocation, '回收位置'),
    reason,
    operator: normalizedOperator(source.operator, '回收操作人', '中转袋回收员'),
    source: requiredEventSource(source.source, '回收来源'),
    occurredAt: text(source.occurredAt)
      || new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
}

function normalizeScrapTransferBagInput(
  input: ScrapTransferBagInput,
): NormalizedScrapTransferBagInput {
  const source = record(input)
  return {
    bagCode: requiredText(source.bagCode, '中转袋编号'),
    reason: requiredText(source.reason, '报废原因'),
    authorizedBy: requiredText(source.authorizedBy, '报废授权人'),
    operator: normalizedOperator(source.operator, '报废操作人', '中转袋主管'),
    source: requiredEventSource(source.source, '报废来源'),
    occurredAt: text(source.occurredAt)
      || new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
}

function assertRuntimeEventIdAvailable(input: {
  eventType: '中转袋回收' | '中转袋报废'
  refs: { transferBagCode: string; usageCycleId?: string }
  occurredAt: string
  idempotencyKey: string
  events: CuttingRuntimeEvent[]
}): void {
  const eventId = buildCuttingRuntimeEventId(
    input.eventType,
    input.refs,
    input.occurredAt,
  )
  const collision = input.events.find((event) =>
    event.eventId === eventId
    && event.idempotencyKey !== input.idempotencyKey)
  if (collision) {
    throw new Error(`${input.eventType}事件编号 ${eventId} 已被其他事实占用。`)
  }
}

function recoveryStateError(current: TransferBagCurrentUse): string {
  if (current.mainStatus === 'DISABLED') return '这个袋子已经报废，不能回收。'
  if (current.mainStatus === 'IDLE') return '这个袋子当前空闲，无需回收。'
  if (
    current.flowStage === 'PACKED'
    || current.flowStage === 'INBOUND_STORED'
    || current.flowStage === 'READY_HANDOVER'
    || current.tickets.length > 0
  ) return '这个袋子还有有效菲票，请先拆袋重装。'
  return '这个袋子当前不是已交出待回收，不能回收。'
}

function scrapStateError(current: TransferBagCurrentUse): string {
  if (current.mainStatus === 'DISABLED') return '这个袋子已经报废，不能重复报废。'
  if (current.flowStage === 'HANDED_OVER_WAITING_RETURN') {
    return '请先确认实物空袋回收，再报废。'
  }
  if (
    current.flowStage === 'PACKED'
    || current.flowStage === 'INBOUND_STORED'
    || current.flowStage === 'READY_HANDOVER'
    || current.tickets.length > 0
  ) return '这个袋子还有有效菲票，请先拆袋重装。'
  return '这个袋子当前不是空闲状态，不能报废。'
}

export function recoverTransferBag(
  input: RecoverTransferBagInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<'中转袋回收'> {
  const normalized = normalizeRecoverTransferBagInput(input)
  const events = listCuttingRuntimeEvents(storage)
  const completeRecoveryFacts = events
    .map(parseCompleteRecoveryEvent)
    .filter((fact): fact is NonNullable<ReturnType<typeof parseCompleteRecoveryEvent>> =>
      Boolean(fact && fact.payload.bagCode === normalized.bagCode))
  const current = resolveTransferBagCurrentUse(normalized.bagCode, storage)
  const retryCandidates = current.flowStage === 'HANDED_OVER_WAITING_RETURN'
    && current.usageCycleId
    ? completeRecoveryFacts.filter((fact) =>
        fact.payload.usageCycleId === current.usageCycleId)
    : completeRecoveryFacts
  const equivalent = retryCandidates.find((fact) =>
    fact.canonicalIntent === canonicalRecoveryIntent(
      normalized,
      fact.payload.usageCycleId,
    ))
  if (equivalent) return cloneRuntimeEvent(equivalent.event)

  if (
    (current.mainStatus === 'IDLE' || current.mainStatus === 'DISABLED')
    && completeRecoveryFacts.length
  ) {
    throw new Error('中转袋回收的业务意图冲突。')
  }
  if (
    current.flowStage !== 'HANDED_OVER_WAITING_RETURN'
    || !current.usageCycleId
  ) {
    throw new Error(recoveryStateError(current))
  }

  const usageCycleId = current.usageCycleId
  const idempotencyKey = `${usageCycleId}:PHYSICAL_BAG_RETURNED`
  const collisions = events.filter((event) => event.idempotencyKey === idempotencyKey)
  if (collisions.length) {
    const fact = collisions.length === 1 ? parseCompleteRecoveryEvent(collisions[0]) : null
    if (
      fact
      && fact.canonicalIntent === canonicalRecoveryIntent(normalized, usageCycleId)
    ) return cloneRuntimeEvent(fact.event)
    throw new Error('中转袋回收的业务意图冲突。')
  }
  assertRuntimeEventIdAvailable({
    eventType: '中转袋回收',
    refs: { transferBagCode: normalized.bagCode, usageCycleId },
    occurredAt: normalized.occurredAt,
    idempotencyKey,
    events,
  })

  const appendResult = appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '中转袋回收',
    eventSource: normalized.source,
    eventStatus: '已同步',
    occurredAt: normalized.occurredAt,
    operatorId: normalized.operator.operatorId,
    operatorName: normalized.operator.operatorName,
    operatorRole: normalized.operator.operatorRole,
    refs: {
      transferBagCode: normalized.bagCode,
      usageCycleId,
    },
    payload: {
      bagCode: normalized.bagCode,
      usageCycleId,
      physicalBagReceived: true,
      physicalBagEmpty: true,
      recoveryMode: normalized.recoveryMode,
      recoveryNode: normalized.recoveryNode,
      recoveryLocation: normalized.recoveryLocation,
      reason: normalized.reason,
      recoveredAt: normalized.occurredAt,
      recoveredBy: normalized.operator.operatorName,
    },
  }, storage)
  const persisted = parseCompleteRecoveryEvent(appendResult.event)
  if (
    !persisted
    || persisted.canonicalIntent !== canonicalRecoveryIntent(normalized, usageCycleId)
  ) throw new Error('中转袋回收事实写入后校验失败。')
  return cloneRuntimeEvent(persisted.event)
}

export function submitTransferBagScrap(
  input: ScrapTransferBagInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<'中转袋报废'> {
  const normalized = normalizeScrapTransferBagInput(input)
  const events = listCuttingRuntimeEvents(storage)
  const idempotencyKey = `${normalized.bagCode}:BAG_SCRAPPED`
  const collisions = events.filter((event) => event.idempotencyKey === idempotencyKey)
  if (collisions.length) {
    const fact = collisions.length === 1 ? parseCompleteScrapEvent(collisions[0]) : null
    if (fact && fact.canonicalIntent === canonicalScrapIntent(normalized)) {
      return cloneRuntimeEvent(fact.event)
    }
    throw new Error('中转袋报废的业务意图冲突。')
  }

  const current = resolveTransferBagCurrentUse(normalized.bagCode, storage)
  if (current.mainStatus !== 'IDLE' || current.tickets.length > 0) {
    throw new Error(scrapStateError(current))
  }
  assertRuntimeEventIdAvailable({
    eventType: '中转袋报废',
    refs: { transferBagCode: normalized.bagCode },
    occurredAt: normalized.occurredAt,
    idempotencyKey,
    events,
  })
  const appendResult = appendCuttingRuntimeEventIdempotent({
    idempotencyKey,
    eventType: '中转袋报废',
    eventSource: normalized.source,
    eventStatus: '已同步',
    occurredAt: normalized.occurredAt,
    operatorId: normalized.operator.operatorId,
    operatorName: normalized.operator.operatorName,
    operatorRole: normalized.operator.operatorRole,
    refs: { transferBagCode: normalized.bagCode },
    payload: {
      bagCode: normalized.bagCode,
      idleConfirmed: true,
      reason: normalized.reason,
      authorizedBy: normalized.authorizedBy,
      scrappedAt: normalized.occurredAt,
      scrappedBy: normalized.operator.operatorName,
    },
  }, storage)
  const persisted = parseCompleteScrapEvent(appendResult.event)
  if (!persisted || persisted.canonicalIntent !== canonicalScrapIntent(normalized)) {
    throw new Error('中转袋报废事实写入后校验失败。')
  }
  return cloneRuntimeEvent(persisted.event)
}

export function recoverThenScrapTransferBag(input: {
  recovery: RecoverTransferBagInput
  scrap: Omit<ScrapTransferBagInput, 'bagCode' | 'source' | 'operator'>
}, storage: BrowserStorageLike | null = getBrowserLocalStorage()): {
  recoveryEvent: CuttingRuntimeEvent<'中转袋回收'>
  scrapEvent: CuttingRuntimeEvent<'中转袋报废'>
} {
  const recoveryEvent = recoverTransferBag(input.recovery, storage)
  const bagCode = requiredText(input.recovery.bagCode, '中转袋编号')
  const current = resolveTransferBagCurrentUse(bagCode, storage)
  if (current.mainStatus !== 'IDLE' || current.tickets.length > 0) {
    throw new Error('中转袋回收后未进入空闲状态，不能继续报废。')
  }
  const scrapEvent = submitTransferBagScrap({
    ...input.scrap,
    bagCode,
    source: input.recovery.source,
    operator: input.recovery.operator,
  }, storage)
  return { recoveryEvent, scrapEvent }
}

export function ensureTransferBagAvailableForUse(input: {
  bagCode: string
  forceRecovery?: Omit<RecoverTransferBagInput, 'bagCode' | 'recoveryMode'>
}, storage: BrowserStorageLike | null = getBrowserLocalStorage()): {
  recovered: boolean
  current: TransferBagCurrentUse
} {
  const bagCode = requiredText(input.bagCode, '中转袋编号')
  const current = resolveTransferBagCurrentUse(bagCode, storage)
  if (current.mainStatus === 'IDLE') return { recovered: false, current }
  if (current.mainStatus === 'DISABLED') {
    throw new Error('这个袋子已经报废，不能继续使用。')
  }
  if (
    current.flowStage === 'PACKED'
    || current.flowStage === 'INBOUND_STORED'
    || current.flowStage === 'READY_HANDOVER'
    || current.tickets.length > 0
  ) throw new Error('这个袋子还有有效菲票，请先拆袋重装。')
  if (current.flowStage !== 'HANDED_OVER_WAITING_RETURN') {
    throw new Error('这个袋子当前不能继续使用。')
  }
  if (!input.forceRecovery) {
    throw new Error('这个袋子尚未确认实物空袋回收，不能继续使用。')
  }
  recoverTransferBag({
    ...input.forceRecovery,
    bagCode,
    recoveryMode: 'FORCED',
  }, storage)
  const recoveredCurrent = resolveTransferBagCurrentUse(bagCode, storage)
  if (recoveredCurrent.mainStatus !== 'IDLE') {
    throw new Error('强制回收后中转袋未进入空闲状态，不能继续使用。')
  }
  return { recovered: true, current: recoveredCurrent }
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

export interface TransferBagAuthoritativeLocationFact {
  sourceEventId: string
  warehouseArea: string
  locationCode: string
  locationRef?: RuntimeWarehouseLocationRef
}

export function parseTransferBagAuthoritativeLocationFact(
  event: CuttingRuntimeEvent,
): TransferBagAuthoritativeLocationFact | null {
  const payload = eventPayload(event)
  const rawLocationRef = record(payload.locationRef)
  const warehouseArea = text(payload.warehouseArea)
    || text(event.inventoryEffect?.toWarehouseArea)
  const locationCode = text(payload.locationCode)
    || text(event.inventoryEffect?.toLocationCode)
  const locationRef = {
    factoryId: text(rawLocationRef.factoryId),
    warehouseId: text(rawLocationRef.warehouseId),
    warehouseKind: rawLocationRef.warehouseKind === 'WAIT_PROCESS'
      ? 'WAIT_PROCESS' as const
      : rawLocationRef.warehouseKind === 'WAIT_HANDOVER'
        ? 'WAIT_HANDOVER' as const
        : null,
    areaId: text(rawLocationRef.areaId),
    areaName: text(rawLocationRef.areaName),
    shelfId: text(rawLocationRef.shelfId),
    shelfNo: text(rawLocationRef.shelfNo),
    locationId: text(rawLocationRef.locationId),
    locationNo: text(rawLocationRef.locationNo),
  }
  const inventoryMatches = Boolean(
    warehouseArea
    && locationCode
    && text(event.inventoryEffect?.toWarehouseArea) === warehouseArea
    && text(event.inventoryEffect?.toLocationCode) === locationCode
  )
  const completeLocationRef = Boolean(
    locationRef.factoryId
    && locationRef.warehouseId
    && locationRef.warehouseKind === 'WAIT_HANDOVER'
    && locationRef.areaId
    && locationRef.areaName
    && locationRef.locationId
    && locationRef.locationNo
    && locationRef.areaName === warehouseArea
    && locationRef.locationNo === locationCode
  )
  if (
    !warehouseArea
    || !locationCode
    || !inventoryMatches
    || (event.eventType === '特殊工艺回仓' && !completeLocationRef)
  ) return null
  return {
    sourceEventId: event.eventId,
    warehouseArea,
    locationCode,
    ...(completeLocationRef
      ? { locationRef: locationRef as RuntimeWarehouseLocationRef }
      : {}),
  }
}

export function resolveTransferBagAuthoritativeCurrentLocation(input: {
  bagCode: string
  usageCycleId: string
  events: CuttingRuntimeEvent[]
}): TransferBagAuthoritativeLocationFact | null {
  let current: TransferBagAuthoritativeLocationFact | null = null
  const events = [...input.events]
    .filter((event) => event.eventStatus !== '已取消')
    .sort(compareCuttingRuntimeChronologyAscending)
  for (const event of events) {
    if (
      !eventTouchesTransferBag(event, input.bagCode)
      || eventUsageCycleId(event) !== input.usageCycleId
    ) continue
    if (event.eventType === '新增交出记录') {
      if (isCompleteSuccessfulWholeBagHandoverEvent(event)) current = null
      continue
    }
    if (event.eventType === '特殊工艺交出') {
      if (isCompleteSuccessfulSpecialCraftHandoverEvent(event)) current = null
      continue
    }
    if (
      event.eventType === '中转袋入仓'
      || event.eventType === '特殊工艺回仓'
    ) {
      if (
        event.eventStatus !== '已记录'
        && event.eventStatus !== '已同步'
      ) continue
      current = parseTransferBagAuthoritativeLocationFact(event)
    }
  }
  return current
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
  if (!input.currentUse.usageCycleId) {
    throw new Error('当前中转袋缺少使用周期，不能确认唯一来源库位。')
  }
  const source = resolveTransferBagAuthoritativeCurrentLocation({
    bagCode: input.currentUse.bagCode,
    usageCycleId: input.currentUse.usageCycleId,
    events: input.events,
  })
  if (!source) {
    throw new Error('无法唯一确认当前待交出仓库位，不能整袋交出。')
  }
  return {
    warehouseArea: source.warehouseArea,
    locationCode: source.locationCode,
    ...(source.locationRef ? { locationRef: source.locationRef } : {}),
  }
}

function requiredHandoverText(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${label}不能为空。`)
  return normalized
}

function buildWholeBagHandoverCanonicalIntent(input: {
  bagCode: string
  usageCycleId: string
  handoverLegId: string
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
    .map((item) => ({
      feiTicketId: text(item.feiTicketId),
      feiTicketNo: text(item.feiTicketNo),
      sewingTaskId: text(item.sewingTaskId),
      sewingTaskNo: text(item.sewingTaskNo),
      receiverFactoryId: text(item.receiverFactoryId),
      receiverFactoryName: text(item.receiverFactoryName),
    }))
    .sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId))
  const submittedTicketSnapshot = input.submittedTicketSnapshot
    .map((item) => ({
      feiTicketId: text(item.feiTicketId),
      feiTicketNo: text(item.feiTicketNo),
      productionOrderId: text(item.productionOrderId),
      productionOrderNo: text(item.productionOrderNo),
      cutOrderId: text(item.cutOrderId),
      cutOrderNo: text(item.cutOrderNo),
      color: text(item.color),
      size: text(item.size),
      partCode: text(item.partCode),
      partName: text(item.partName),
      pieceQty: item.pieceQty,
      sewingTaskId: text(item.sewingTaskId),
      sewingTaskNo: text(item.sewingTaskNo),
      receiverFactoryId: text(item.receiverFactoryId),
      receiverFactoryName: text(item.receiverFactoryName),
    }))
    .sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId))
  return JSON.stringify({
    bagCode: input.bagCode,
    usageCycleId: input.usageCycleId,
    handoverLegId: input.handoverLegId,
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

export function buildSpecialCraftWholeBagHandoverCanonicalIntent(input: {
  bagCode: string
  usageCycleId: string
  handoverLegId: string
  handoverOrderId: string
  handoverRecordId: string
  specialCraftId: string
  craftCategory: '辅助工艺' | '特种工艺'
  craftType: string
  receiverFactoryId: string
  receiverFactoryName: string
  feiTicketItems: CompleteSpecialCraftHandoverPayload['feiTicketItems']
  ticketSnapshot: TransferBagTicketFactSnapshot[]
  sourceInventoryEventId: string
  sourceWarehouseArea: string
  sourceLocationCode: string
  sourceLocationRef?: RuntimeWarehouseLocationRef
  handedOverAt: string
  handedOverBy: string
  idempotencyKey: string
  source: CuttingRuntimeEventSource
  operator: TransferBagRuntimeOperator
}): string {
  const feiTicketItems = input.feiTicketItems
    .map((item) => ({
      feiTicketId: text(item.feiTicketId),
      feiTicketNo: text(item.feiTicketNo),
      specialCraftId: text(item.specialCraftId),
      partName: text(item.partName),
      size: text(item.size),
      pieceQty: item.pieceQty,
    }))
    .sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId))
  const ticketSnapshot = input.ticketSnapshot
    .map(normalizeWholeBagTicketSnapshot)
    .sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId))
  const rawSourceLocationRef = record(input.sourceLocationRef)
  const sourceLocationRef = text(rawSourceLocationRef.locationId)
    ? {
        factoryId: text(rawSourceLocationRef.factoryId),
        warehouseId: text(rawSourceLocationRef.warehouseId),
        warehouseKind: rawSourceLocationRef.warehouseKind === 'WAIT_PROCESS' ? 'WAIT_PROCESS' : 'WAIT_HANDOVER',
        areaId: text(rawSourceLocationRef.areaId),
        areaName: text(rawSourceLocationRef.areaName),
        shelfId: text(rawSourceLocationRef.shelfId),
        shelfNo: text(rawSourceLocationRef.shelfNo),
        locationId: text(rawSourceLocationRef.locationId),
        locationNo: text(rawSourceLocationRef.locationNo),
      }
    : null
  return JSON.stringify({
    bagCode: text(input.bagCode),
    usageCycleId: text(input.usageCycleId),
    handoverLegId: text(input.handoverLegId),
    handoverOrderId: text(input.handoverOrderId),
    handoverRecordId: text(input.handoverRecordId),
    specialCraftId: text(input.specialCraftId),
    craftCategory: input.craftCategory,
    craftType: text(input.craftType),
    receiverFactoryId: text(input.receiverFactoryId),
    receiverFactoryName: text(input.receiverFactoryName),
    feiTicketItems,
    ticketSnapshot,
    sourceInventoryEventId: text(input.sourceInventoryEventId),
    sourceWarehouseArea: text(input.sourceWarehouseArea),
    sourceLocationCode: text(input.sourceLocationCode),
    sourceLocationRef,
    handedOverAt: text(input.handedOverAt),
    handedOverBy: text(input.handedOverBy),
    idempotencyKey: text(input.idempotencyKey),
    source: input.source,
    operator: {
      operatorId: text(input.operator.operatorId),
      operatorName: text(input.operator.operatorName),
      operatorRole: text(input.operator.operatorRole) || '特殊工艺交出员',
    },
  })
}

interface StrictSpecialCraftHandoverEventFact {
  event: CuttingRuntimeEvent<'特殊工艺交出'>
  handoverRecordId: string
  bagCode: string
  usageCycleId: string
  handoverLegId: string
  handoverSequence: number
  canonicalIntent: string
}

const SPECIAL_CRAFT_SNAPSHOT_REQUIRED_FIELDS: Array<keyof TransferBagTicketFactSnapshot> = [
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
]

interface StrictWholeBagHandoverEventFact {
  event: CuttingRuntimeEvent<'新增交出记录'>
  handoverRecordId: string
  bagCode: string
  usageCycleId: string
  handoverLegId: string
  handoverSequence: number
  productionOrderId: string
  productionOrderNo: string
  canonicalIntent: string
}

function parseHandoverLegSequence(
  usageCycleId: string,
  handoverLegId: string,
): number | null {
  const prefix = `${usageCycleId}:handover:`
  if (!handoverLegId.startsWith(prefix)) return null
  const rawSequence = handoverLegId.slice(prefix.length)
  if (!/^[1-9]\d*$/.test(rawSequence)) return null
  const sequence = Number(rawSequence)
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null
}

function strictRequiredStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.length) return null
  const values = value.map(text)
  if (values.some((item) => !item) || new Set(values).size !== values.length) return null
  return values
}

function parseStrictSpecialCraftHandoverEvent(
  event: CuttingRuntimeEvent,
): StrictSpecialCraftHandoverEventFact | null {
  if (
    event.eventType !== '特殊工艺交出'
    || (event.eventStatus !== '已记录' && event.eventStatus !== '已同步')
  ) return null

  const payload = eventPayload(event)
  const bagCode = text(payload.bagCode)
  const usageCycleId = text(payload.usageCycleId)
  const handoverLegId = text(payload.handoverLegId)
  const handoverSequence = parseHandoverLegSequence(usageCycleId, handoverLegId)
  const handoverOrderId = text(payload.handoverOrderId)
  const handoverRecordId = text(payload.handoverRecordId)
  const specialCraftId = text(event.refs.specialCraftId)
  const craftCategory = payload.craftCategory
  const craftType = text(payload.craftType)
  const receiverFactoryId = text(payload.receiverFactoryId)
  const receiverFactoryName = text(payload.receiverFactoryName)
  const sourceWarehouseArea = text(payload.sourceWarehouseArea)
  const sourceLocationCode = text(payload.sourceLocationCode)
  const sourceInventoryEventId = text(payload.sourceInventoryEventId)
  const handedOverAt = text(payload.handedOverAt)
  const handedOverBy = text(payload.handedOverBy)
  const idempotencyKey = text(payload.idempotencyKey)
  if (
    !bagCode
    || !usageCycleId
    || handoverSequence === null
    || !handoverOrderId
    || !handoverRecordId
    || !specialCraftId
    || (craftCategory !== '辅助工艺' && craftCategory !== '特种工艺')
    || !craftType
    || !receiverFactoryId
    || !receiverFactoryName
    || !sourceWarehouseArea
    || !sourceLocationCode
    || !sourceInventoryEventId
    || !handedOverAt
    || !handedOverBy
    || !idempotencyKey
  ) return null

  const rawSnapshot = records(payload.ticketSnapshot)
  if (!rawSnapshot.length) return null
  const ticketSnapshot = rawSnapshot.map((item) =>
    normalizeWholeBagTicketSnapshot(item as unknown as TransferBagTicketFactSnapshot))
  if (ticketSnapshot.some((item) =>
    SPECIAL_CRAFT_SNAPSHOT_REQUIRED_FIELDS.some((field) => field === 'pieceQty'
      ? !Number.isFinite(item.pieceQty) || item.pieceQty <= 0
      : !text(item[field])))) return null
  const snapshotTicketIds = strictRequiredStringArray(ticketSnapshot.map((item) => item.feiTicketId))
  const snapshotTicketNos = strictRequiredStringArray(ticketSnapshot.map((item) => item.feiTicketNo))
  if (!snapshotTicketIds || !snapshotTicketNos) return null

  const feiTicketItems = records(payload.feiTicketItems)
  const itemTicketIds = strictRequiredStringArray(feiTicketItems.map((item) => item.feiTicketId))
  if (!itemTicketIds || !sameStrings(itemTicketIds, snapshotTicketIds)) return null
  const snapshotById = new Map(ticketSnapshot.map((item) => [item.feiTicketId, item]))
  if (feiTicketItems.some((item) => {
    const snapshot = snapshotById.get(text(item.feiTicketId))
    return !snapshot
      || text(item.feiTicketNo) !== snapshot.feiTicketNo
      || text(item.specialCraftId) !== specialCraftId
      || text(item.partName) !== snapshot.partName
      || text(item.size) !== snapshot.size
      || item.pieceQty !== snapshot.pieceQty
  })) return null

  const totalPieceQty = ticketSnapshot.reduce((sum, item) => sum + item.pieceQty, 0)
  if (
    text(event.refs.transferBagCode) !== bagCode
    || text(event.refs.usageCycleId) !== usageCycleId
    || text(event.refs.handoverLegId) !== handoverLegId
    || text(event.refs.handoverOrderId) !== handoverOrderId
    || text(event.refs.handoverRecordId) !== handoverRecordId
    || !sameStrings(event.refs.feiTicketIds || [], snapshotTicketIds)
    || !sameStrings(event.refs.feiTicketNos || [], snapshotTicketNos)
    || event.idempotencyKey !== idempotencyKey
    || !event.inventoryEffect
    || event.inventoryEffect.inventoryScope !== '裁床待交出仓'
    || event.inventoryEffect.direction !== 'OUT'
    || event.inventoryEffect.qty !== totalPieceQty
    || event.inventoryEffect.unit !== '片'
    || text(event.inventoryEffect.fromWarehouseArea) !== sourceWarehouseArea
    || text(event.inventoryEffect.fromLocationCode) !== sourceLocationCode
    || handedOverAt !== event.occurredAt
    || handedOverBy !== event.operatorName
  ) return null

  const canonicalIntent = buildSpecialCraftWholeBagHandoverCanonicalIntent({
    bagCode,
    usageCycleId,
    handoverLegId,
    handoverOrderId,
    handoverRecordId,
    specialCraftId,
    craftCategory,
    craftType,
    receiverFactoryId,
    receiverFactoryName,
    feiTicketItems: feiTicketItems as unknown as CompleteSpecialCraftHandoverPayload['feiTicketItems'],
    ticketSnapshot,
    sourceInventoryEventId,
    sourceWarehouseArea,
    sourceLocationCode,
    sourceLocationRef: payload.locationRef as RuntimeWarehouseLocationRef | undefined,
    handedOverAt,
    handedOverBy,
    idempotencyKey,
    source: event.eventSource,
    operator: {
      operatorId: event.operatorId,
      operatorName: event.operatorName,
      operatorRole: event.operatorRole,
    },
  })
  if (text(payload.canonicalIntent) !== canonicalIntent) return null

  return {
    event: event as CuttingRuntimeEvent<'特殊工艺交出'>,
    handoverRecordId,
    bagCode,
    usageCycleId,
    handoverLegId,
    handoverSequence,
    canonicalIntent,
  }
}

function parseStrictWholeBagHandoverEvent(
  event: CuttingRuntimeEvent,
): StrictWholeBagHandoverEventFact | null {
  if (
    event.eventType !== '新增交出记录'
    || (event.eventStatus !== '已记录' && event.eventStatus !== '已同步')
  ) return null

  const payload = eventPayload(event)
  const handoverOrderId = text(payload.handoverOrderId)
  const handoverOrderNo = text(payload.handoverOrderNo)
  const handoverRecordId = text(payload.handoverRecordId)
  const handoverRecordNo = text(payload.handoverRecordNo)
  const receiverId = text(payload.receiverId)
  const receiverName = text(payload.receiverName)
  const submittedAt = text(payload.submittedAt)
  const submittedBy = text(payload.submittedBy)
  if (
    !handoverOrderId
    || !handoverOrderNo
    || !handoverRecordId
    || !handoverRecordNo
    || payload.receiverType !== '车缝厂'
    || !receiverId
    || !receiverName
    || !submittedAt
    || !submittedBy
  ) return null

  const transferBagUses = records(payload.transferBagUses)
  if (transferBagUses.length !== 1) return null
  const bagUse = transferBagUses[0]
  const bagCode = text(bagUse.bagCode)
  const usageCycleId = text(bagUse.bagUseId)
  const handoverLegId = text(payload.handoverLegId)
  const handoverSequence = parseHandoverLegSequence(usageCycleId, handoverLegId)
  const containedFeiTicketIds = strictRequiredStringArray(bagUse.containedFeiTicketIds)
  const sewingTaskIds = strictRequiredStringArray(bagUse.sewingTaskIds)
  const sewingTaskNos = strictRequiredStringArray(bagUse.sewingTaskNos)
  const sourceWarehouseArea = text(bagUse.sourceWarehouseArea)
  const sourceLocationCode = text(bagUse.sourceLocationCode)
  if (
    !bagCode
    || !usageCycleId
    || handoverSequence === null
    || !containedFeiTicketIds
    || !sewingTaskIds
    || !sewingTaskNos
    || !sourceWarehouseArea
    || !sourceLocationCode
  ) return null

  let ticketSnapshot: TransferBagTicketFactSnapshot[]
  try {
    ticketSnapshot = normalizeRequiredSubmittedTicketSnapshot(bagUse.ticketSnapshot)
  } catch {
    return null
  }
  const snapshotTicketIds = ticketSnapshot.map((ticket) => ticket.feiTicketId)
  const snapshotTicketNos = ticketSnapshot.map((ticket) => ticket.feiTicketNo)
  if (!sameStrings(containedFeiTicketIds, snapshotTicketIds)) return null

  const productionOrderIds = unique(ticketSnapshot.map((ticket) => ticket.productionOrderId))
  const productionOrderNos = unique(ticketSnapshot.map((ticket) => ticket.productionOrderNo))
  const snapshotTaskIds = unique(ticketSnapshot.map((ticket) => ticket.sewingTaskId))
  const snapshotTaskNos = unique(ticketSnapshot.map((ticket) => ticket.sewingTaskNo))
  const receiverIds = unique(ticketSnapshot.map((ticket) => ticket.receiverFactoryId))
  const receiverNames = unique(ticketSnapshot.map((ticket) => ticket.receiverFactoryName))
  if (
    productionOrderIds.length !== 1
    || productionOrderNos.length !== 1
    || receiverIds.length !== 1
    || receiverNames.length !== 1
    || receiverIds[0] !== receiverId
    || receiverNames[0] !== receiverName
    || !sameStrings(sewingTaskIds, snapshotTaskIds)
    || !sameStrings(sewingTaskNos, snapshotTaskNos)
  ) return null
  const taskNoById = new Map<string, string>()
  const taskIdByNo = new Map<string, string>()
  for (const ticket of ticketSnapshot) {
    const mappedTaskNo = taskNoById.get(ticket.sewingTaskId)
    const mappedTaskId = taskIdByNo.get(ticket.sewingTaskNo)
    if (
      (mappedTaskNo && mappedTaskNo !== ticket.sewingTaskNo)
      || (mappedTaskId && mappedTaskId !== ticket.sewingTaskId)
    ) return null
    taskNoById.set(ticket.sewingTaskId, ticket.sewingTaskNo)
    taskIdByNo.set(ticket.sewingTaskNo, ticket.sewingTaskId)
  }

  const totalPieceQty = ticketSnapshot.reduce((sum, ticket) => sum + ticket.pieceQty, 0)
  if (
    bagUse.totalPieceQty !== totalPieceQty
    || payload.currentHandedOverQty !== totalPieceQty
  ) return null
  const feiTicketItems = records(payload.feiTicketItems)
  const feiTicketItemIds = strictRequiredStringArray(feiTicketItems.map((item) => item.feiTicketId))
  if (!feiTicketItemIds || !sameStrings(feiTicketItemIds, snapshotTicketIds)) return null
  const snapshotById = new Map(ticketSnapshot.map((ticket) => [ticket.feiTicketId, ticket]))
  if (feiTicketItems.some((item) => {
    const snapshot = snapshotById.get(text(item.feiTicketId))
    return !snapshot
      || text(item.feiTicketNo) !== snapshot.feiTicketNo
      || item.pieceQty !== snapshot.pieceQty
      || item.unit !== '片'
  })) return null

  if (
    text(event.refs.transferBagCode) !== bagCode
    || text(event.refs.usageCycleId) !== usageCycleId
    || text(event.refs.handoverOrderId) !== handoverOrderId
    || text(event.refs.handoverRecordId) !== handoverRecordId
    || text(event.refs.productionOrderId) !== productionOrderIds[0]
    || text(event.refs.productionOrderNo) !== productionOrderNos[0]
    || text(event.refs.handoverLegId) !== handoverLegId
    || event.idempotencyKey !== `whole-bag-handover:${handoverRecordId}`
    || !sameStrings(event.refs.feiTicketIds || [], snapshotTicketIds)
    || !sameStrings(event.refs.feiTicketNos || [], snapshotTicketNos)
    || !sameStrings(event.refs.sewingTaskIds || [], sewingTaskIds)
    || !sameStrings(event.refs.sewingTaskNos || [], sewingTaskNos)
  ) return null
  if (
    !event.inventoryEffect
    || event.inventoryEffect.inventoryScope !== '裁床待交出仓'
    || event.inventoryEffect.direction !== 'OUT'
    || event.inventoryEffect.qty !== totalPieceQty
    || event.inventoryEffect.unit !== '片'
    || text(event.inventoryEffect.fromWarehouseArea) !== sourceWarehouseArea
    || text(event.inventoryEffect.fromLocationCode) !== sourceLocationCode
    || submittedAt !== event.occurredAt
    || submittedBy !== event.operatorName
  ) return null

  const assignments = ticketSnapshot.map((ticket) => ({
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    sewingTaskId: ticket.sewingTaskId,
    sewingTaskNo: ticket.sewingTaskNo,
    receiverFactoryId: ticket.receiverFactoryId,
    receiverFactoryName: ticket.receiverFactoryName,
  }))
  const canonicalIntent = buildWholeBagHandoverCanonicalIntent({
    bagCode,
    usageCycleId,
    handoverLegId,
    handoverOrderId,
    handoverOrderNo,
    handoverRecordId,
    handoverRecordNo,
    assignments,
    submittedTicketSnapshot: ticketSnapshot,
    source: event.eventSource,
    operator: {
      operatorId: event.operatorId,
      operatorName: event.operatorName,
      operatorRole: event.operatorRole,
    },
  })
  if (text(payload.canonicalIntent) !== canonicalIntent) return null

  return {
    event: event as CuttingRuntimeEvent<'新增交出记录'>,
    handoverRecordId,
    bagCode,
    usageCycleId,
    handoverLegId,
    handoverSequence,
    productionOrderId: productionOrderIds[0],
    productionOrderNo: productionOrderNos[0],
    canonicalIntent,
  }
}

export function isCompleteSuccessfulWholeBagHandoverEvent(
  event: CuttingRuntimeEvent,
): boolean {
  return Boolean(parseStrictWholeBagHandoverEvent(event))
}

export function isCompleteSuccessfulSpecialCraftHandoverEvent(
  event: CuttingRuntimeEvent,
): boolean {
  return Boolean(parseStrictSpecialCraftHandoverEvent(event))
}

export function buildNextTransferBagHandoverLeg(input: {
  bagCode: string
  usageCycleId: string
  events: CuttingRuntimeEvent[]
}): {
  handoverLegId: string
  handoverSequence: number
} {
  const sequences = input.events.flatMap((event) => {
    if (
      text(event.refs.transferBagCode) !== input.bagCode
      || text(event.refs.usageCycleId) !== input.usageCycleId
    ) return []
    if (event.eventType === '新增交出记录') {
      const fact = parseStrictWholeBagHandoverEvent(event)
      return fact ? [fact.handoverSequence] : []
    }
    if (event.eventType !== '特殊工艺交出') return []
    const fact = parseStrictSpecialCraftHandoverEvent(event)
    return fact ? [fact.handoverSequence] : []
  })
  const handoverSequence = Math.max(0, ...sequences) + 1
  return {
    handoverLegId: `${input.usageCycleId}:handover:${handoverSequence}`,
    handoverSequence,
  }
}

function findWholeBagHandoverEventsByRecordId(
  events: CuttingRuntimeEvent[],
  handoverRecordId: string,
): CuttingRuntimeEvent<'新增交出记录'>[] {
  return events.filter((event) =>
    event.eventType === '新增交出记录'
    && (
      text(event.refs.handoverRecordId) === handoverRecordId
      || text(eventPayload(event).handoverRecordId) === handoverRecordId
    )) as CuttingRuntimeEvent<'新增交出记录'>[]
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
  const existingRecords = findWholeBagHandoverEventsByRecordId(events, handoverRecordId)
  if (existingRecords.length) {
    const existingFact = existingRecords.length === 1
      ? parseStrictWholeBagHandoverEvent(existingRecords[0])
      : null
    if (!existingFact) {
      throw new Error(`交出记录 ID ${handoverRecordId} 已存在，但本次请求业务意图冲突。`)
    }
    let retryCanonicalIntent = ''
    try {
      retryCanonicalIntent = buildWholeBagHandoverCanonicalIntent({
        bagCode,
        usageCycleId,
        handoverLegId: existingFact.handoverLegId,
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
    if (existingFact.canonicalIntent === retryCanonicalIntent) {
      return existingFact.event
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
  const handoverLeg = buildNextTransferBagHandoverLeg({
    bagCode,
    usageCycleId,
    events,
  })
  const canonicalIntent = buildWholeBagHandoverCanonicalIntent({
    bagCode,
    usageCycleId,
    handoverLegId: handoverLeg.handoverLegId,
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
    handoverLegId: handoverLeg.handoverLegId,
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
  const appendResult = appendCuttingRuntimeEventIdempotent({
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
      handoverLegId: handoverLeg.handoverLegId,
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
  }, storage)
  const persistedFact = parseStrictWholeBagHandoverEvent(appendResult.event)
  if (
    !persistedFact
    || persistedFact.handoverRecordId !== handoverRecordId
    || persistedFact.bagCode !== bagCode
    || persistedFact.usageCycleId !== currentUse.usageCycleId
    || persistedFact.productionOrderId !== ticketSnapshot[0].productionOrderId
    || persistedFact.productionOrderNo !== ticketSnapshot[0].productionOrderNo
    || persistedFact.canonicalIntent !== canonicalIntent
  ) {
    throw new Error(`交出记录 ID ${handoverRecordId} 已存在，但本次请求业务意图冲突。`)
  }
  return persistedFact.event
}
