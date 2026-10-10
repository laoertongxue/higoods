import { localDateTimeText } from '../../../utils.ts'
import { isCutPieceTicketUsable } from './cut-piece-ticket-validity.ts'
import { listCutPieceReleaseTicketDetails, getCutPieceReleaseEligibilityForDetail } from './cut-piece-release-facts.ts'
import { getRuntimeTaskById, isRuntimeSewingTask, autoStartRuntimeSewingTaskFromCutPieceHandover } from '../runtime-process-tasks.ts'
import { listWoolPanelCuttingReceiptSources, WOOL_DEFAULT_CUTTING_FACTORY_ID } from '../wool-domain/cutting-receipts.ts'
import {
  appendCuttingRuntimeEventIdempotent,
  appendCuttingRuntimeEventIdempotentValidated,
  buildCuttingRuntimeEventId,
  listManagedCuttingRuntimeEvents,
  listSimpleCutPieceHandoverEvents,
  type AppendCuttingRuntimeEventInput,
  type CuttingRuntimeEvent,
  type CuttingRuntimeEventSource,
  type CompleteSpecialCraftHandoverPayload,
  type RuntimeWarehouseLocationRef,
  type SpecialCraftReturnPayload,
  type TransferBagRecoveryPayload,
  type TransferBagRepackPayload,
  type TransferBagScrapPayload,
  type TransferBagTicketFactSnapshot,
  type WholeBagHandoverSubmitPayload,
} from './cutting-runtime-event-ledger.ts'
import type { FeiTicketSewingAssignment } from './sewing-dispatch.ts'
import {
  compareCuttingRuntimeChronologyAscending,
  createCuttingRuntimeChronologyComparator,
  normalizeCuttingRuntimeLedgerSequence,
} from './cutting-runtime-chronology.ts'
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
  idleTransitionEventId?: string
  idleTransitionType?: 'RECOVERY' | 'REPACK'
  compatibilityBlockedReason?: string
}

export interface TransferBagRuntimeOperator {
  operatorId?: string
  operatorName: string
  operatorRole?: string
}

export interface SubmitTransferBagRepackInput {
  repackBatchId: string
  handoverContext?: TransferBagHandoverTaskContext
  sourceBagCodes: string[]
  results: Array<{
    bagCode: string
    feiTicketIds: string[]
  }>
  retainedSources?: Array<{
    bagCode: string
    feiTicketIds: string[]
    returnLocationRef: RuntimeWarehouseLocationRef
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
  handoverContext?: TransferBagHandoverTaskContext
  existingHandoverEvents?: CuttingRuntimeEvent[]
  submittedTicketSnapshot: TransferBagTicketFactSnapshot[]
  storage?: BrowserStorageLike | null
}

export interface SubmitWholeBagHandoverInput {
  bagCode: string
  usageCycleId: string
  handoverOrderId: string
  handoverOrderNo: string
  handoverRecordId: string
  handoverRecordNo: string
  handoverContext?: TransferBagHandoverTaskContext
  assignments: FeiTicketSewingAssignment[]
  submittedTicketSnapshot: TransferBagTicketFactSnapshot[]
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}

export interface TransferBagHandoverTaskContext {
  handoverBatchId: string
  productionOrderId: string
  productionOrderNo: string
  sewingTaskId: string
  sewingTaskNo: string
  receiverFactoryId: string
  receiverFactoryName: string
  receiverPpicId: string
  receiverPpicName: string
  targetFeiTicketIds: string[]
}

export type TransferBagTaskDisposition = 'DIRECT_HANDOVER' | 'REPACK_REQUIRED'

export interface TransferBagTaskClassification {
  disposition: TransferBagTaskDisposition
  targetTickets: TransferBagTicketFactSnapshot[]
  otherTickets: TransferBagTicketFactSnapshot[]
  reason: string
}

function normalizeHandoverTaskContext(context: TransferBagHandoverTaskContext): TransferBagHandoverTaskContext {
  const normalized: TransferBagHandoverTaskContext = {
    handoverBatchId: context.handoverBatchId.trim(),
    productionOrderId: context.productionOrderId.trim(),
    productionOrderNo: context.productionOrderNo.trim(),
    sewingTaskId: context.sewingTaskId.trim(),
    sewingTaskNo: context.sewingTaskNo.trim(),
    receiverFactoryId: context.receiverFactoryId.trim(),
    receiverFactoryName: context.receiverFactoryName.trim(),
    receiverPpicId: context.receiverPpicId.trim(),
    receiverPpicName: context.receiverPpicName.trim(),
    targetFeiTicketIds: unique(context.targetFeiTicketIds),
  }
  const missing = Object.entries(normalized)
    .find(([key, value]) => key !== 'targetFeiTicketIds' && typeof value === 'string' && !value)
  if (missing) throw new Error(`本次车缝任务交出上下文缺少 ${missing[0]}。`)
  if (!normalized.targetFeiTicketIds.length) throw new Error('本次车缝任务没有可交出的目标菲票。')
  return normalized
}

export function classifyTransferBagForHandoverTask(input: {
  currentUse: TransferBagCurrentUse
  handoverContext: TransferBagHandoverTaskContext
}): TransferBagTaskClassification {
  const context = normalizeHandoverTaskContext(input.handoverContext)
  const targetIds = new Set(context.targetFeiTicketIds)
  const targetTickets = input.currentUse.tickets.filter((ticket) => targetIds.has(ticket.feiTicketId))
  const otherTickets = input.currentUse.tickets.filter((ticket) => !targetIds.has(ticket.feiTicketId))
  if (!targetTickets.length) {
    return { disposition: 'REPACK_REQUIRED', targetTickets, otherTickets, reason: '该袋不包含本次车缝任务菲票。' }
  }
  if (otherTickets.length) {
    return {
      disposition: 'REPACK_REQUIRED',
      targetTickets,
      otherTickets,
      reason: `该袋另有 ${otherTickets.length} 张非本任务菲票，需要拆袋重装。`,
    }
  }
  return { disposition: 'DIRECT_HANDOVER', targetTickets, otherTickets, reason: '' }
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

export interface SubmitSpecialCraftBagReturnInput {
  sourceHandoverRecordId: string
  bagCode: string
  returnedTicketIds: string[]
  /** 必须逐票明确点收，未填不能用预计量代替。 */
  ticketReceipts?: SpecialCraftTicketReceiptInput[]
  locationRef: RuntimeWarehouseLocationRef
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}

export interface SpecialCraftTicketReceiptInput {
  feiTicketId: string
  returnedQty: number | string
  differenceReason?: string
  processingCompleted?: boolean
}

/** BAG-001/002: 普通与工艺票、不同身份或顺序的工艺链不得混袋。 */
export function buildSpecialCraftBagChainKey(input: { hasSpecialCraft: boolean; craftSequenceVersion?: string; specialCrafts?: readonly { craftCode?: string; craftType?: string; craftName?: string; craftCategory: string; receiverFactoryId: string }[] }): string {
  if (!input.hasSpecialCraft) return 'NONE'
  const crafts = input.specialCrafts || []
  if (!text(input.craftSequenceVersion) || !crafts.length || crafts.some(craft => !text(craft.craftCode || craft.craftType || craft.craftName) || !text(craft.craftCategory) || !text(craft.receiverFactoryId))) return ''
  return JSON.stringify([text(input.craftSequenceVersion), crafts.map(craft => [text(craft.craftCode || craft.craftType || craft.craftName), text(craft.craftCategory), text(craft.receiverFactoryId)])])
}

export function assertSpecialCraftBagCompatibility(tickets: readonly {
  feiTicketNo: string
  hasSpecialCraft: boolean
  specialCraftChainKey?: string
}[]): void {
  const keys = tickets.map(ticket => {
    if (!ticket.hasSpecialCraft) return 'NONE'
    const key = text(ticket.specialCraftChainKey)
    if (!key || key.endsWith(':')) throw new Error(`${ticket.feiTicketNo} 的工艺要求待补齐，请核对部位加工要求后装袋。`)
    return key
  })
  if (new Set(keys).size > 1) throw new Error('这张票需要不同加工，请另选中转袋；普通票和不同工艺顺序的票不能混袋。')
}

/** RECEIPT-001..006: 保存前按票核对，空白与零量具有不同含义。 */
export function validateSpecialCraftTicketReceipts(
  ticketSnapshot: readonly TransferBagTicketFactSnapshot[],
  receipts: readonly SpecialCraftTicketReceiptInput[] | undefined,
  requireProcessingCompletion = true,
): Array<{ feiTicketId: string; returnedQty: number; differenceReason: string; processingCompleted?: true }> {
  if (!receipts || receipts.length !== ticketSnapshot.length) throw new Error('请逐张菲票确认实际实收数量，不能使用预计数自动入仓。')
  const byId = new Map(ticketSnapshot.map(ticket => [ticket.feiTicketId, ticket]))
  const seen = new Set<string>()
  const result = receipts.map(receipt => {
    const ticketId = text(receipt.feiTicketId)
    const ticket = byId.get(ticketId)
    if (!ticket || seen.has(ticketId)) throw new Error(`回仓菲票 ${ticketId || '未填写'} 不属于本次交出或重复填写。`)
    seen.add(ticketId)
    if (!isCutPieceTicketUsable(ticketId)) throw new Error(`${ticket.feiTicketNo} 已登记整票不可用，不能按有效裁片回仓。`)
    if (requireProcessingCompletion && receipt.processingCompleted !== true) throw new Error(`${ticket.feiTicketNo}：请逐票核对本阶段加工完成后再确认回仓。`)
    const rawQty = receipt.returnedQty
    if (typeof rawQty !== 'number' && (typeof rawQty !== 'string' || !/^\d+$/.test(rawQty.trim()))) throw new Error(`${ticket.feiTicketNo}：请明确填写非负整数实收片数，空白不能当作 0。`)
    const qty = Number(rawQty)
    if (!Number.isSafeInteger(qty) || qty < 0) throw new Error(`${ticket.feiTicketNo}：实收必须是非负安全整数片数。`)
    if (!Number.isSafeInteger(ticket.pieceQty) || ticket.pieceQty <= 0 || qty > ticket.pieceQty) throw new Error(`${ticket.feiTicketNo}：实收不能超过本次应回 ${ticket.pieceQty} 片，请先核对交出数量。`)
    const differenceReason = text(receipt.differenceReason)
    if (qty !== ticket.pieceQty && !differenceReason) throw new Error(`${ticket.feiTicketNo}：少回 ${ticket.pieceQty - qty} 片，请填写实际点收差异原因。`)
    return { feiTicketId: ticketId, returnedQty: qty, differenceReason, ...(receipt.processingCompleted === true ? { processingCompleted: true as const } : {}) }
  })
  if (!Number.isSafeInteger(result.reduce((sum, receipt) => sum + receipt.returnedQty, 0))) throw new Error('本次实收总片数超出安全整数范围，请核对原交出明细。')
  return result
}

export interface SubmitSpecialCraftTicketOnlyReturnInput {
  payload: SpecialCraftReturnPayload
  specialCraftId: string
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
  idempotencyKey?: string
}

interface CompleteSpecialCraftBagReturnPayload extends SpecialCraftReturnPayload {
  canonicalIntent: string
  bagCode: string
  usageCycleId: string
  handoverLegId: string
  sourceHandoverEventId: string
  ticketSnapshot: TransferBagTicketFactSnapshot[]
  idempotencyKey: string
}

interface CompleteSpecialCraftTicketOnlyReturnPayload extends SpecialCraftReturnPayload {
  canonicalIntent: string
  sourceHandoverEventId: string
  ticketSnapshot: TransferBagTicketFactSnapshot[]
  idempotencyKey: string
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

import { isFabricBagTicket, validBagTicketQuantity, bagTicketFieldMissing, mixedBagTicketFields, MIXED_BAG_EXTRA_FIELDS } from './mixed-transfer-bag-ticket.ts'
import { isBrowserBusinessStorageStaged } from '../../browser-storage.ts'

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
      && [...WHOLE_BAG_SNAPSHOT_FIELDS, ...MIXED_BAG_EXTRA_FIELDS].every((field) => ticket[field] === expected?.[field])
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
    WHOLE_BAG_SNAPSHOT_FIELDS.some((field) => bagTicketFieldMissing(item, field)))
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
  const storage = input.storage === undefined ? getBrowserLocalStorage() : input.storage
  let handoverContext: TransferBagHandoverTaskContext | undefined
  if (input.handoverContext) {
    try {
      handoverContext = normalizeHandoverTaskContext(input.handoverContext)
    } catch (error) {
      return failedWholeBagHandover(error instanceof Error ? error.message : '本次车缝任务交出上下文不完整。')
    }
  }
  // 核心业务校验顺序固定为：阶段 → 非空 → 单生产单 → 逐票分配 →
  // 唯一接收工厂 → 当前周期重复交出 → 完整提交快照；兼容阻断只能在其后追加。
  if (currentUse.flowStage !== 'INBOUND_STORED' && currentUse.flowStage !== 'READY_HANDOVER') {
    return failedWholeBagHandover('当前中转袋不是入仓暂存中或待交出，不能整袋交出。')
  }
  if (!currentUse.tickets.length) {
    return failedWholeBagHandover('当前中转袋没有菲票，不能整袋交出。')
  }
  const simplyHandedOver = new Set(listSimpleCutPieceHandoverEvents(storage).flatMap((event) => [...event.payload.tickets, ...(event.payload.replacementFabricTickets || [])].map((ticket) => ticket.feiTicketId)))
  if (currentUse.tickets.some((ticket) => simplyHandedOver.has(ticket.feiTicketId))) {
    return failedWholeBagHandover('袋内菲票已经通过简易裁片交出，请重新核对袋内裁片。')
  }

  if (handoverContext) {
    const assignmentsByTicket = new Map(input.assignments.map((assignment) => [assignment.feiTicketId, assignment]))
    const assignedCurrentUse = { ...currentUse, tickets: currentUse.tickets.map((ticket) => {
      const assignment = assignmentsByTicket.get(ticket.feiTicketId)
      return assignment ? { ...ticket, sewingTaskId: assignment.sewingTaskId, sewingTaskNo: assignment.sewingTaskNo, receiverFactoryId: assignment.receiverFactoryId, receiverFactoryName: assignment.receiverFactoryName } : ticket
    }) }
    const classification = classifyTransferBagForHandoverTask({ currentUse: assignedCurrentUse, handoverContext })
    if (classification.disposition !== 'DIRECT_HANDOVER') {
      return failedWholeBagHandover(classification.reason)
    }
    if (currentUse.productionOrderNo.trim() !== handoverContext.productionOrderNo) {
      return failedWholeBagHandover('当前中转袋生产单与本次车缝任务不一致。')
    }
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
    || (!isFabricBagTicket(ticket) && !ticket.feiTicketNo.startsWith('WOOL-PANEL:') && (!ticket.cutOrderId.trim() || !ticket.cutOrderNo.trim()))
    || !ticket.color.trim()
    || (!isFabricBagTicket(ticket) && (!ticket.size.trim() || !ticket.partCode.trim() || !ticket.partName.trim()))
    || !validBagTicketQuantity(ticket))
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
    if (handoverContext && (
      assignment.sewingTaskId.trim() !== handoverContext.sewingTaskId
      || assignment.sewingTaskNo.trim() !== handoverContext.sewingTaskNo
      || assignment.receiverFactoryId.trim() !== handoverContext.receiverFactoryId
      || assignment.receiverFactoryName.trim() !== handoverContext.receiverFactoryName
    )) {
      return failedWholeBagHandover(`菲票 ${ticket.feiTicketNo} 不属于本次选定的车缝任务。`)
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
  if (handoverContext && (
    receiverFactoryIds[0] !== handoverContext.receiverFactoryId
    || receiverFactoryNames[0] !== handoverContext.receiverFactoryName
  )) {
    return failedWholeBagHandover('接收车缝工厂与本次车缝任务不一致。')
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
  const cutPieceTickets = ticketSnapshot.filter(ticket => !isFabricBagTicket(ticket) && !ticket.feiTicketNo.startsWith('WOOL-PANEL:'))
  if (cutPieceTickets.length) {
    const details = new Map(listCutPieceReleaseTicketDetails(new Set(cutPieceTickets.map(ticket => ticket.feiTicketId))).map(detail => [detail.ticketId, detail]))
    const receipts = listSpecialCraftTicketReturnFacts(undefined, storage)
    for (const ticket of cutPieceTickets) {
      if (!isCutPieceTicketUsable(ticket.feiTicketId)) return failedWholeBagHandover(`${ticket.feiTicketNo} 整票不可用，不能交出。`)
      const eligibility = getCutPieceReleaseEligibilityForDetail(details.get(ticket.feiTicketId))
      if (!eligibility.found || !eligibility.canHandover) return failedWholeBagHandover(eligibility.reason || '菲票资料待核对，不能交出。')
      if (ticket.pieceQty !== eligibility.physicalPieceQty || (eligibility.requiresSpecialCraft && ticket.pieceQty !== eligibility.eligiblePieceQty)) return failedWholeBagHandover(`${ticket.feiTicketNo} 的袋内数量与当前有效数量不一致，请核对后重新装袋。`)
      const receipt = receipts.filter(item => item.feiTicketId === ticket.feiTicketId).at(-1)
      if (receipt && ticket.pieceQty !== receipt.returnedQty) return failedWholeBagHandover(`${ticket.feiTicketNo} 的袋内数量与最新实收数量不一致，请核对后重新装袋。`)
    }
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

function isCompleteRepackLocationRef(value: unknown): boolean {
  if (!isRecord(value)) return false
  return Boolean(
    text(value.factoryId)
    && text(value.warehouseId)
    && value.warehouseKind === 'WAIT_HANDOVER'
    && text(value.areaId)
    && text(value.areaName)
    && text(value.locationId)
    && text(value.locationNo)
  )
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
    && value.beforeTickets.every(isCompleteTransferBagTicketSnapshot)
    && (
      value.outcome === undefined
      || (
        ['RESULT_HANDOVER', 'RETURN_INBOUND', 'EMPTY_IDLE'].includes(text(value.outcome))
        && Array.isArray(value.afterTickets)
        && value.afterTickets.every(isCompleteTransferBagTicketSnapshot)
        && (value.outcome !== 'RETURN_INBOUND' || isCompleteRepackLocationRef(value.returnLocationRef))
      )
    ))
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
  return sortRuntimeEventSnapshot(listManagedCuttingRuntimeEvents(storage))
}

function sortRuntimeEventSnapshot(events: readonly CuttingRuntimeEvent[]): CuttingRuntimeEvent[] {
  const active = events.filter((event) => event.eventStatus !== '已取消')
  return active.sort(createCuttingRuntimeChronologyComparator(active))
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
    ...mixedBagTicketFields(value),
    feiTicketId: text(value.feiTicketId),
    feiTicketNo: text(value.feiTicketNo),
    productionOrderId: text(value.productionOrderId) || event.refs.productionOrderId || '',
    productionOrderNo: text(value.productionOrderNo) || event.refs.productionOrderNo || '',
    cutOrderId: typeof value.cutOrderId === 'string' ? text(value.cutOrderId) : event.refs.cutOrderId || '',
    cutOrderNo: typeof value.cutOrderNo === 'string' ? text(value.cutOrderNo) : event.refs.cutOrderNo || '',
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
  if (tickets.some((ticket) => !validBagTicketQuantity(ticket))) {
    return '历史袋内快照缺少有效片数事实，当前关系仅供核查，不能拆袋重装。'
  }
  if (tickets.some((ticket) => !isFabricBagTicket(ticket) && !ticket.receiverFactoryId)) {
    return '历史袋内快照缺少接收工厂事实，当前关系仅供核查，不能拆袋重装。'
  }
  if (tickets.some((ticket) => !isFabricBagTicket(ticket) && (!ticket.sewingTaskId || !ticket.sewingTaskNo))) {
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

export function parseCompleteRecoveryEvent(event: CuttingRuntimeEvent): {
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
  kind: 'sourceBags',
  bagCode: string,
): TransferBagRepackPayload['sourceBags'][number] | undefined
function repackBag(
  event: CuttingRuntimeEvent,
  kind: 'resultBags',
  bagCode: string,
): TransferBagRepackPayload['resultBags'][number] | undefined
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
  validatedSpecialHandoverIds?: ReadonlySet<string>,
): TransferBagCurrentUse {
  let state = emptyCurrentUse(bagCode)
  const validSpecialHandoverIds = validatedSpecialHandoverIds
    || new Set(listSpecialCraftHandoverFacts(events).map(fact => fact.event.eventId))
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
      } else {
        const source = repackBag(event, 'sourceBags', bagCode)
        if (source?.outcome === 'RETURN_INBOUND') {
          const tickets = records(source.afterTickets).map((item) => ticketSnapshot(item, event))
          state = {
            ...state,
            usageCycleId: text(source.usageCycleId) || state.usageCycleId,
            productionOrderNo: unique(tickets.map((ticket) => ticket.productionOrderNo))[0] || '',
            tickets,
            mainStatus: 'IN_USE',
            flowStage: 'PACKED',
            compatibilityBlockedReason: compatibilityReasonForTickets(tickets),
          }
        } else if (source) {
          state = {
            ...emptyCurrentUse(bagCode),
            idleTransitionEventId: event.eventId,
            idleTransitionType: 'REPACK',
          }
        }
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
      const specialCraftHandover = validSpecialHandoverIds.has(event.eventId) ? parseStrictSpecialCraftHandoverEvent(event) : null
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
      const returned = parseStrictSpecialCraftBagReturnEvent(event)
      if (
        !returned
        || (returned.payload.correctionOfEventId && returned.payload.inventoryAdjusted === false)
        || returned.bagCode !== bagCode
        || returned.usageCycleId !== state.usageCycleId
        || returned.sourceHandoverEventId !== state.latestHandoverEventId
        || (state.flowStage !== 'HANDED_OVER_WAITING_RETURN' && !(returned.payload.correctionOfEventId && state.flowStage === 'INBOUND_STORED'))
      ) continue
      const tickets = receivedTicketSnapshots(returned.payload)
      state = {
        ...state,
        productionOrderNo: unique(tickets.map((ticket) => ticket.productionOrderNo))[0] || state.productionOrderNo,
        tickets,
        mainStatus: 'IN_USE',
        flowStage: 'INBOUND_STORED',
        compatibilityBlockedReason: compatibilityReasonForTickets(tickets),
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
      ) {
        state = {
          ...emptyCurrentUse(bagCode),
          idleTransitionEventId: event.eventId,
          idleTransitionType: 'RECOVERY',
        }
      }
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

export function resolveTransferBagCurrentUseByTicketId(
  feiTicketId: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): TransferBagCurrentUse | null {
  const normalizedTicketId = feiTicketId.trim()
  if (!normalizedTicketId) return null
  const events = sortedRuntimeEvents(storage)
  const bagCode = buildCurrentTicketBagIndexFromSnapshot(events).get(normalizedTicketId)
  return bagCode
    ? resolveTransferBagCurrentUseFromEvents(bagCode, events, true)
    : null
}

export function resolveTransferBagCurrentUsesFromEvents(
  bagCodes: readonly string[],
  events: readonly CuttingRuntimeEvent[],
): Map<string, TransferBagCurrentUse> {
  const orderedEvents = sortRuntimeEventSnapshot(events)
  const normalizedBagCodes = unique(bagCodes.map((bagCode) => bagCode.trim()))
  const validSpecialHandoverIds = new Set(listSpecialCraftHandoverFacts(orderedEvents).map(fact => fact.event.eventId))
  return new Map(normalizedBagCodes.map((bagCode) => [
    bagCode,
    resolveTransferBagCurrentUseFromEvents(bagCode, orderedEvents, true, validSpecialHandoverIds),
  ]))
}

function strictRuntimeEventPrefix(
  event: CuttingRuntimeEvent,
  events: CuttingRuntimeEvent[],
): CuttingRuntimeEvent[] | null {
  const ordered = sortRuntimeEventSnapshot(events)
  let eventIndex = ordered.findIndex((item) => item === event)
  if (eventIndex < 0) {
    eventIndex = ordered.findIndex((item) =>
      item.eventId === event.eventId
      && item.ledgerSequence === event.ledgerSequence
      && item.idempotencyKey === event.idempotencyKey)
  }
  if (eventIndex < 0) return null
  const targetSequence = normalizeCuttingRuntimeLedgerSequence(event.ledgerSequence)
  return ordered.slice(0, eventIndex).filter((item) => {
    if (item.occurredAt !== event.occurredAt) return true
    const itemSequence = normalizeCuttingRuntimeLedgerSequence(item.ledgerSequence)
    return targetSequence !== undefined && itemSequence !== undefined
      ? itemSequence < targetSequence
      : compareCuttingRuntimeChronologyAscending(item, event) < 0
  })
}

function completeRecoveryTransitionIdentity(
  event: CuttingRuntimeEvent,
): { bagCode: string; usageCycleId: string } | null {
  const parsed = parseCompleteRecoveryEvent(event)
  if (parsed) {
    return {
      bagCode: parsed.payload.bagCode,
      usageCycleId: parsed.payload.usageCycleId,
    }
  }
  const payload = eventPayload(event)
  const bagCode = text(payload.bagCode)
  const usageCycleId = text(payload.usageCycleId)
  return isCompleteLegacyRecoveryEvent(event, bagCode, usageCycleId || null)
    ? { bagCode, usageCycleId }
    : null
}

export function isEffectiveTransferBagRecoveryEvent(
  event: CuttingRuntimeEvent,
  events: CuttingRuntimeEvent[],
): boolean {
  const identity = completeRecoveryTransitionIdentity(event)
  const prefix = strictRuntimeEventPrefix(event, events)
  if (!identity || !prefix) return false
  const before = resolveTransferBagCurrentUseFromEvents(identity.bagCode, prefix, true)
  if (
    before.mainStatus !== 'IN_USE'
    || before.flowStage !== 'HANDED_OVER_WAITING_RETURN'
    || before.usageCycleId !== identity.usageCycleId
  ) return false
  const after = resolveTransferBagCurrentUseFromEvents(
    identity.bagCode,
    [...prefix, event],
    true,
  )
  return after.mainStatus === 'IDLE'
    && after.flowStage === null
    && after.usageCycleId === null
    && after.tickets.length === 0
}

export function isEffectiveTransferBagScrapEvent(
  event: CuttingRuntimeEvent,
  events: CuttingRuntimeEvent[],
): boolean {
  const parsed = parseCompleteScrapEvent(event)
  const payload = eventPayload(event)
  const bagCode = parsed?.payload.bagCode || text(payload.bagCode)
  const complete = Boolean(parsed) || isCompleteLegacyScrapEvent(event, bagCode)
  const prefix = strictRuntimeEventPrefix(event, events)
  if (!complete || !bagCode || !prefix) return false
  const before = resolveTransferBagCurrentUseFromEvents(bagCode, prefix, true)
  if (before.mainStatus !== 'IDLE' || before.tickets.length > 0) return false
  const after = resolveTransferBagCurrentUseFromEvents(
    bagCode,
    [...prefix, event],
    true,
  )
  return after.mainStatus === 'DISABLED'
    && after.flowStage === null
    && after.tickets.length === 0
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
    occurredAt: normalizeTransferBagOperationTime(source.occurredAt),
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
    occurredAt: normalizeTransferBagOperationTime(source.occurredAt),
  }
}

function normalizeTransferBagOperationTime(value: unknown): string {
  const normalized = text(value)
  if (!normalized) return new Date().toISOString()
  const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
    && Number.isFinite(Date.parse(normalized))
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(isoTime ? normalized.slice(0, 16).replace('T', ' ') : normalized)
  if (!match) {
    throw new Error('操作时间格式不正确，请使用 YYYY-MM-DD HH:mm。')
  }
  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  if (
    year < 1
    || month < 1
    || month > 12
    || day < 1
    || day > daysInMonth[month - 1]
    || hour < 0
    || hour > 23
    || minute < 0
    || minute > 59
  ) {
    throw new Error('操作时间格式不正确，请使用 YYYY-MM-DD HH:mm。')
  }
  return normalized
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

function resolveTransferBagCurrentUseFromSnapshot(
  bagCode: string,
  events: readonly CuttingRuntimeEvent[],
): TransferBagCurrentUse {
  return resolveTransferBagCurrentUseFromEvents(
    bagCode,
    sortRuntimeEventSnapshot(events),
    true,
  )
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

function buildRecoveryAppendInput(
  input: NormalizedRecoverTransferBagInput,
  usageCycleId: string,
): AppendCuttingRuntimeEventInput<'中转袋回收'> & { idempotencyKey: string } {
  return {
    idempotencyKey: `${usageCycleId}:PHYSICAL_BAG_RETURNED`,
    eventType: '中转袋回收',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt: input.occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole,
    refs: {
      transferBagCode: input.bagCode,
      usageCycleId,
    },
    payload: {
      bagCode: input.bagCode,
      usageCycleId,
      physicalBagReceived: true,
      physicalBagEmpty: true,
      recoveryMode: input.recoveryMode,
      recoveryNode: input.recoveryNode,
      recoveryLocation: input.recoveryLocation,
      reason: input.reason,
      recoveredAt: input.occurredAt,
      recoveredBy: input.operator.operatorName,
    },
  }
}

function buildScrapAppendInput(
  input: NormalizedScrapTransferBagInput,
): AppendCuttingRuntimeEventInput<'中转袋报废'> & { idempotencyKey: string } {
  return {
    idempotencyKey: `${input.bagCode}:BAG_SCRAPPED`,
    eventType: '中转袋报废',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt: input.occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole,
    refs: { transferBagCode: input.bagCode },
    payload: {
      bagCode: input.bagCode,
      idleConfirmed: true,
      reason: input.reason,
      authorizedBy: input.authorizedBy,
      scrappedAt: input.occurredAt,
      scrappedBy: input.operator.operatorName,
    },
  }
}

export function recoverTransferBag(
  input: RecoverTransferBagInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<'中转袋回收'> {
  const normalized = normalizeRecoverTransferBagInput(input)
  const result = appendCuttingRuntimeEventIdempotentValidated<'中转袋回收'>(
    (snapshotEvents) => {
      const events = [...snapshotEvents]
      const current = resolveTransferBagCurrentUseFromSnapshot(normalized.bagCode, events)
      if (
        current.flowStage === 'PACKED'
        || current.flowStage === 'INBOUND_STORED'
        || current.flowStage === 'READY_HANDOVER'
        || current.tickets.length > 0
      ) throw new Error(recoveryStateError(current))

      const completeRecoveryFacts = events
        .map(parseCompleteRecoveryEvent)
        .filter((fact): fact is NonNullable<ReturnType<typeof parseCompleteRecoveryEvent>> =>
          Boolean(fact && fact.payload.bagCode === normalized.bagCode))
      const retryCandidates = current.flowStage === 'HANDED_OVER_WAITING_RETURN'
        && current.usageCycleId
        ? completeRecoveryFacts.filter((fact) =>
            fact.payload.usageCycleId === current.usageCycleId)
        : current.mainStatus === 'IDLE' || current.mainStatus === 'DISABLED'
          ? completeRecoveryFacts
          : []
      const equivalent = retryCandidates.find((fact) =>
        fact.canonicalIntent === canonicalRecoveryIntent(
          normalized,
          fact.payload.usageCycleId,
        ) && isEffectiveTransferBagRecoveryEvent(fact.event, events))

      if (
        !equivalent
        && (current.mainStatus === 'IDLE' || current.mainStatus === 'DISABLED')
        && completeRecoveryFacts.length
      ) throw new Error('中转袋回收的业务意图冲突。')
      if (
        !equivalent
        && (current.flowStage !== 'HANDED_OVER_WAITING_RETURN' || !current.usageCycleId)
      ) throw new Error(recoveryStateError(current))

      const usageCycleId = equivalent?.payload.usageCycleId || current.usageCycleId
      if (!usageCycleId) throw new Error(recoveryStateError(current))
      const appendInput = buildRecoveryAppendInput(normalized, usageCycleId)
      const collisions = events.filter((event) =>
        event.idempotencyKey === appendInput.idempotencyKey)
      if (collisions.length > 1) throw new Error('中转袋回收的业务意图冲突。')
      if (!collisions.length) {
        assertRuntimeEventIdAvailable({
          eventType: '中转袋回收',
          refs: { transferBagCode: normalized.bagCode, usageCycleId },
          occurredAt: normalized.occurredAt,
          idempotencyKey: appendInput.idempotencyKey,
          events,
        })
      }
      return appendInput
    },
    (candidate, snapshotEvents) => {
      if (!isEffectiveTransferBagRecoveryEvent(candidate, [...snapshotEvents, candidate])) {
        throw new Error('回收时间不能早于当前交出事实。')
      }
    },
    storage,
  )
  if (!result.appended) {
    const fact = parseCompleteRecoveryEvent(result.event)
    if (
      fact
      && fact.canonicalIntent === canonicalRecoveryIntent(
        normalized,
        fact.payload.usageCycleId,
      )
      && isEffectiveTransferBagRecoveryEvent(fact.event, [...result.snapshotEvents])
    ) return cloneRuntimeEvent(fact.event)
    throw new Error('中转袋回收的业务意图冲突。')
  }
  return cloneRuntimeEvent(result.event)
}

export function submitTransferBagScrap(
  input: ScrapTransferBagInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<'中转袋报废'> {
  const normalized = normalizeScrapTransferBagInput(input)
  const result = appendCuttingRuntimeEventIdempotentValidated<'中转袋报废'>(
    (snapshotEvents) => {
      const events = [...snapshotEvents]
      const appendInput = buildScrapAppendInput(normalized)
      const collisions = events.filter((event) =>
        event.idempotencyKey === appendInput.idempotencyKey)
      if (collisions.length > 1) throw new Error('中转袋报废的业务意图冲突。')
      if (!collisions.length) {
        const current = resolveTransferBagCurrentUseFromSnapshot(normalized.bagCode, events)
        if (current.mainStatus !== 'IDLE' || current.tickets.length > 0) {
          throw new Error(scrapStateError(current))
        }
        assertRuntimeEventIdAvailable({
          eventType: '中转袋报废',
          refs: { transferBagCode: normalized.bagCode },
          occurredAt: normalized.occurredAt,
          idempotencyKey: appendInput.idempotencyKey,
          events,
        })
      }
      return appendInput
    },
    (candidate, snapshotEvents) => {
      if (!isEffectiveTransferBagScrapEvent(candidate, [...snapshotEvents, candidate])) {
        throw new Error('报废时间不能早于袋子进入空闲状态的时间。')
      }
    },
    storage,
  )
  if (!result.appended) {
    const fact = parseCompleteScrapEvent(result.event)
    if (
      fact
      && fact.canonicalIntent === canonicalScrapIntent(normalized)
      && isEffectiveTransferBagScrapEvent(fact.event, [...result.snapshotEvents])
    ) return cloneRuntimeEvent(fact.event)
    throw new Error('中转袋报废的业务意图冲突。')
  }
  return cloneRuntimeEvent(result.event)
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
  const normalizedScrap = normalizeScrapTransferBagInput({
    ...input.scrap,
    bagCode,
    source: input.recovery.source,
    operator: input.recovery.operator,
  })
  if (normalizedScrap.occurredAt.localeCompare(recoveryEvent.occurredAt, 'zh-CN') < 0) {
    throw new Error('报废时间不能早于回收时间。')
  }
  const scrapEvent = submitTransferBagScrap(normalizedScrap, storage)
  const disabled = resolveTransferBagCurrentUse(bagCode, storage)
  if (disabled.mainStatus !== 'DISABLED') {
    throw new Error('中转袋报废后未进入已报废状态。')
  }
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
    throw new Error(`菲票 ${duplicateAcrossResults} 跨结果袋重复。`)
  }
  const retainedSources = (input.retainedSources || []).map((source) => ({
    bagCode: source.bagCode.trim(),
    feiTicketIds: assertUniqueNonEmpty(
      source.feiTicketIds,
      `${source.bagCode.trim() || '剩余来源袋'} 的保留菲票编号`,
    ),
    returnLocationRef: { ...source.returnLocationRef },
  }))
  assertUniqueNonEmpty(retainedSources.map((source) => source.bagCode), '剩余来源袋编号')
  return {
    repackBatchId,
    sourceBagCodes,
    results,
    retainedSources,
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
  handoverContext?: TransferBagHandoverTaskContext
  retainedSources?: Array<{
    bagCode: string
    feiTicketIds: string[]
    returnLocationRef: RuntimeWarehouseLocationRef
  }>
}): string {
  return JSON.stringify({
    ...(input.handoverContext ? { handoverContext: normalizeHandoverTaskContext(input.handoverContext) } : {}),
    sourceBagCodes: input.sourceBagCodes.map((bagCode) => bagCode.trim()).sort(),
    results: input.results
      .map((result) => ({
        bagCode: result.bagCode.trim(),
        feiTicketIds: result.feiTicketIds.map((feiTicketId) => feiTicketId.trim()).sort(),
      }))
      .sort((left, right) => left.bagCode.localeCompare(right.bagCode, 'zh-CN')),
    retainedSources: (input.retainedSources || [])
      .map((source) => ({
        bagCode: source.bagCode.trim(),
        feiTicketIds: source.feiTicketIds.map((feiTicketId) => feiTicketId.trim()).sort(),
        returnLocationRef: {
          factoryId: source.returnLocationRef.factoryId,
          warehouseId: source.returnLocationRef.warehouseId,
          warehouseKind: source.returnLocationRef.warehouseKind,
          areaId: source.returnLocationRef.areaId,
          areaName: source.returnLocationRef.areaName,
          shelfId: source.returnLocationRef.shelfId,
          shelfNo: source.returnLocationRef.shelfNo,
          locationId: source.returnLocationRef.locationId,
          locationNo: source.returnLocationRef.locationNo,
        },
      }))
      .sort((left, right) => left.bagCode.localeCompare(right.bagCode, 'zh-CN')),
  })
}

function existingRepackIntent(event: CuttingRuntimeEvent): string {
  const payload = eventPayload(event)
  return canonicalRepackIntent({
    ...(text(payload.handoverBatchId) ? {
      handoverContext: {
        handoverBatchId: text(payload.handoverBatchId),
        productionOrderId: text(payload.productionOrderId),
        productionOrderNo: text(payload.productionOrderNo),
        sewingTaskId: text(payload.sewingTaskId),
        sewingTaskNo: text(payload.sewingTaskNo),
        receiverFactoryId: text(payload.receiverFactoryId),
        receiverFactoryName: text(payload.receiverFactoryName),
        receiverPpicId: text(payload.receiverPpicId),
        receiverPpicName: text(payload.receiverPpicName),
        targetFeiTicketIds: strictRequiredStringArray(payload.targetFeiTicketIds)
          || records(payload.resultBags).flatMap((bag) => records(bag.tickets).map((ticket) => text(ticket.feiTicketId))),
      },
    } : {}),
    sourceBagCodes: records(payload.sourceBags).map((bag) => text(bag.bagCode)),
    results: records(payload.resultBags).map((bag) => ({
      bagCode: text(bag.bagCode),
      feiTicketIds: records(bag.tickets).map((ticket) => text(ticket.feiTicketId)),
    })),
    retainedSources: records(payload.sourceBags)
      .filter((bag) => bag.outcome === 'RETURN_INBOUND')
      .map((bag) => ({
        bagCode: text(bag.bagCode),
        feiTicketIds: records(bag.afterTickets).map((ticket) => text(ticket.feiTicketId)),
        returnLocationRef: record(bag.returnLocationRef) as unknown as RuntimeWarehouseLocationRef,
      })),
  })
}

function assertRepackSourceTicketComplete(ticket: TransferBagTicketFactSnapshot): void {
  if (!ticket.feiTicketId) throw new Error('来源袋存在无法唯一识别的菲票，不能拆袋重装。')
  if (!ticket.productionOrderNo) throw new Error(`${ticket.feiTicketNo || ticket.feiTicketId} 缺少生产单事实，不能拆袋重装。`)
  if (!validBagTicketQuantity(ticket)) {
    throw new Error(`${ticket.feiTicketNo || ticket.feiTicketId} 缺少有效片数，不能拆袋重装。`)
  }
}

export function submitTransferBagRepack(
  input: SubmitTransferBagRepackInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<'中转袋拆袋重装'> {
  const repackBatchId = input.repackBatchId.trim()
  if (!repackBatchId) throw new Error('重装批次编号不能为空。')
  const normalizedInput = normalizeSubmitTransferBagRepackInput(input, repackBatchId)
  const handoverContext = input.handoverContext
    ? normalizeHandoverTaskContext(input.handoverContext)
    : undefined
  const idempotencyKey = `transfer-bag-repack:${repackBatchId}`
  const existing = listManagedCuttingRuntimeEvents(storage).find((event) =>
    event.eventStatus !== '已取消'
    && event.eventType === '中转袋拆袋重装'
    && (
      event.idempotencyKey === idempotencyKey
      || event.refs.repackBatchId?.trim() === repackBatchId
      || text(eventPayload(event).repackBatchId) === repackBatchId
    ))
  if (existing) {
    if (existingRepackIntent(existing) !== canonicalRepackIntent({
      ...normalizedInput,
      ...(handoverContext ? { handoverContext } : {}),
    })) {
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
    const taskScopedCompatibilityCanBeResolved = Boolean(handoverContext)
      && (
        source.compatibilityBlockedReason === '历史袋内快照缺少接收工厂事实，当前关系仅供核查，不能拆袋重装。'
        || source.compatibilityBlockedReason === '历史袋内快照缺少车缝任务事实，当前关系仅供核查，不能拆袋重装。'
      )
    if (source.compatibilityBlockedReason && !taskScopedCompatibilityCanBeResolved) throw new Error(source.compatibilityBlockedReason)
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
    throw new Error(`菲票 ${duplicateResultTicketId} 在结果袋中重复。`)
  }
  const retainedSources = normalizedInput.retainedSources || []
  const retainedTicketIds = retainedSources.flatMap((source) => source.feiTicketIds)
  const duplicateRetainedTicketId = retainedTicketIds.find((id, index) => retainedTicketIds.indexOf(id) !== index)
  if (duplicateRetainedTicketId) throw new Error(`菲票 ${duplicateRetainedTicketId} 在剩余来源袋中重复。`)
  const duplicatedAcrossOutcomes = resultTicketIds.find((id) => retainedTicketIds.includes(id))
  if (duplicatedAcrossOutcomes) throw new Error(`菲票 ${duplicatedAcrossOutcomes} 不能同时进入结果袋并保留在来源袋。`)
  const extraTicketIds = [...resultTicketIds, ...retainedTicketIds].filter((id) => !sourceTicketIds.includes(id))
  if (extraTicketIds.length) throw new Error(`结果袋包含非来源菲票：${extraTicketIds.join('、')}。`)
  const missingTicketIds = sourceTicketIds.filter((id) => !resultTicketIds.includes(id) && !retainedTicketIds.includes(id))
  if (missingTicketIds.length) throw new Error(`结果袋和剩余来源袋缺失来源菲票：${missingTicketIds.join('、')}。`)

  const sourceTicketById = new Map(sourceTickets.map((item) => [item.ticket.feiTicketId, item]))
  // 换片布不在装袋时预占车缝任务；在已确认的任务重装动作中绑定去向。
  if (handoverContext) for (const id of handoverContext.targetFeiTicketIds) {
    const item = sourceTicketById.get(id)
    if (!item || !isFabricBagTicket(item.ticket)) continue
    const ticket = item.ticket
    if (ticket.productionOrderId !== handoverContext.productionOrderId
      || (ticket.sewingTaskId && ticket.sewingTaskId !== handoverContext.sewingTaskId)
      || (ticket.receiverFactoryId && ticket.receiverFactoryId !== handoverContext.receiverFactoryId)) throw new Error('换片布票属于其他生产单、任务或工厂。')
    sourceTicketById.set(id, { ...item, ticket: { ...ticket, sewingTaskId: handoverContext.sewingTaskId,
      sewingTaskNo: handoverContext.sewingTaskNo, receiverFactoryId: handoverContext.receiverFactoryId,
      receiverFactoryName: handoverContext.receiverFactoryName } })
  }
  for (const retained of retainedSources) {
    if (!sourceBagCodes.includes(retained.bagCode)) {
      throw new Error(`${retained.bagCode} 不是本次来源袋，不能登记剩余菲票。`)
    }
    if (resultBagCodes.includes(retained.bagCode)) {
      throw new Error(`${retained.bagCode} 已作为结果袋，不能同时保留为入仓来源袋。`)
    }
    if (!parseCompleteWaitHandoverLocationRef(retained.returnLocationRef)) {
      throw new Error(`${retained.bagCode} 的回仓库位不完整或不属于待交出仓。`)
    }
    for (const feiTicketId of retained.feiTicketIds) {
      if (sourceTicketById.get(feiTicketId)?.fromBagCode !== retained.bagCode) {
        throw new Error(`菲票 ${feiTicketId} 只能保留在原来源袋 ${sourceTicketById.get(feiTicketId)?.fromBagCode || '待核查'}。`)
      }
    }
  }
  for (const result of normalizedInput.results) {
    const resultTickets = result.feiTicketIds.map((id) => sourceTicketById.get(id)!.ticket)
    if (unique(resultTickets.map((ticket) => ticket.productionOrderNo)).length !== 1) {
      throw new Error(`${result.bagCode} 结果袋只能装入同一生产单的菲票。`)
    }
    if (unique(resultTickets.map((ticket) => ticket.receiverFactoryId)).length !== 1) {
      throw new Error(`${result.bagCode} 结果袋的菲票必须对应同一接收工厂。`)
    }
    if (handoverContext) {
      const targetIds = new Set(handoverContext.targetFeiTicketIds)
      const invalidTicket = resultTickets.find((ticket) => !targetIds.has(ticket.feiTicketId))
      if (invalidTicket) throw new Error(`${result.bagCode} 只能装入本次车缝任务的目标菲票。`)
      const wrongTask = resultTickets.find((ticket) =>
        ticket.productionOrderNo !== handoverContext.productionOrderNo
        || ticket.sewingTaskId !== handoverContext.sewingTaskId
        || ticket.sewingTaskNo !== handoverContext.sewingTaskNo
        || ticket.receiverFactoryId !== handoverContext.receiverFactoryId)
      if (wrongTask) throw new Error(`菲票 ${wrongTask.feiTicketNo} 不属于本次选定的车缝任务。`)
    }
  }
  if (handoverContext) {
    const resultIdSet = new Set(resultTicketIds)
    const missingTargetIds = handoverContext.targetFeiTicketIds
      .filter((id) => sourceTicketIds.includes(id) && !resultIdSet.has(id))
    if (missingTargetIds.length) {
      throw new Error(`本次车缝任务菲票尚未全部装入交出结果袋：${missingTargetIds.join('、')}。`)
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
  const resultBagByCode = new Map(resultBags.map((result) => [result.bagCode, result]))
  const retainedSourceByCode = new Map(retainedSources.map((source) => [source.bagCode, source]))
  const chronologicalEvents = listManagedCuttingRuntimeEvents(storage)
  const sourceBags: TransferBagRepackPayload['sourceBags'] = sourceUses.map((source) => {
    const resultBag = resultBagByCode.get(source.bagCode)
    const retainedSource = retainedSourceByCode.get(source.bagCode)
    const originalLocation = source.usageCycleId
      ? resolveTransferBagAuthoritativeCurrentLocation({
          bagCode: source.bagCode,
          usageCycleId: source.usageCycleId,
          events: chronologicalEvents,
        })
      : null
    return {
      bagCode: source.bagCode,
      usageCycleId: source.usageCycleId || '',
      beforeTickets: source.tickets,
      afterTickets: resultBag?.tickets || retainedSource?.feiTicketIds.map((id) => sourceTicketById.get(id)!.ticket) || [],
      outcome: resultBag ? 'RESULT_HANDOVER' : retainedSource ? 'RETURN_INBOUND' : 'EMPTY_IDLE',
      ...(originalLocation?.locationRef ? { originalLocationRef: { ...originalLocation.locationRef } } : {}),
      ...(retainedSource ? { returnLocationRef: { ...retainedSource.returnLocationRef } } : {}),
    }
  })
  const movedTickets: TransferBagRepackPayload['movedTickets'] = resultBags.flatMap((result) =>
    result.tickets.map((ticket) => ({
      feiTicketId: ticket.feiTicketId,
      fromBagCode: sourceTicketById.get(ticket.feiTicketId)!.fromBagCode,
      toBagCode: result.bagCode,
      pieceQty: ticket.pieceQty,
    })))
  const occurredAt = normalizedInput.occurredAt || new Date().toISOString()
  const payload: TransferBagRepackPayload = {
    repackBatchId,
    ...(handoverContext ? {
      handoverBatchId: handoverContext.handoverBatchId,
      productionOrderId: handoverContext.productionOrderId,
      productionOrderNo: handoverContext.productionOrderNo,
      sewingTaskId: handoverContext.sewingTaskId,
      sewingTaskNo: handoverContext.sewingTaskNo,
      receiverFactoryId: handoverContext.receiverFactoryId,
      receiverFactoryName: handoverContext.receiverFactoryName,
      receiverPpicId: handoverContext.receiverPpicId,
      receiverPpicName: handoverContext.receiverPpicName,
      targetFeiTicketIds: [...handoverContext.targetFeiTicketIds],
    } : {}),
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
      ...(handoverContext ? { handoverBatchId: handoverContext.handoverBatchId } : {}),
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
  const warehouseArea = text(payload.warehouseArea)
    || text(event.inventoryEffect?.toWarehouseArea)
  const locationCode = text(payload.locationCode)
    || text(event.inventoryEffect?.toLocationCode)
  const warehouseLocations = Array.isArray(payload.warehouseLocations)
    ? payload.warehouseLocations
    : []
  const locationRef = parseCompleteWaitHandoverLocationRef(payload.locationRef)
    || warehouseLocations
      .map((item) => parseCompleteWaitHandoverLocationRef(item))
      .find((item) => item?.areaName === warehouseArea && item.locationNo === locationCode)
    || null
  const inventoryMatches = Boolean(
    warehouseArea
    && locationCode
    && text(event.inventoryEffect?.toWarehouseArea) === warehouseArea
    && text(event.inventoryEffect?.toLocationCode) === locationCode
  )
  const completeLocationRef = Boolean(
    locationRef
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
  return resolveTransferBagAuthoritativeCurrentLocationFromChronologicalEvents({
    bagCode: input.bagCode,
    usageCycleId: input.usageCycleId,
    chronologicalEvents: sortRuntimeEventSnapshot(input.events),
  })
}

export function resolveTransferBagAuthoritativeCurrentLocationFromChronologicalEvents(input: {
  bagCode: string
  usageCycleId: string
  chronologicalEvents: readonly CuttingRuntimeEvent[]
}): TransferBagAuthoritativeLocationFact | null {
  let current: TransferBagAuthoritativeLocationFact | null = null
  for (const event of input.chronologicalEvents) {
    if (!eventTouchesTransferBag(event, input.bagCode)) continue
    if (event.eventType === '中转袋拆袋重装') {
      const sourceBag = repackBag(event, 'sourceBags', input.bagCode)
      if (sourceBag?.usageCycleId === input.usageCycleId) current = null
      continue
    }
    if (eventUsageCycleId(event) !== input.usageCycleId) continue
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
  handoverContext?: TransferBagHandoverTaskContext
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
    ...(input.handoverContext ? { handoverContext: normalizeHandoverTaskContext(input.handoverContext) } : {}),
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
  directTransfer?: CompleteSpecialCraftHandoverPayload['directTransfer']
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
    ...(input.directTransfer ? { directTransfer: { ...input.directTransfer, completedTicketItems: input.directTransfer.completedTicketItems.map(item => ({ feiTicketId: text(item.feiTicketId), specialCraftId: text(item.specialCraftId), completedQty: item.completedQty, differenceReason: text(item.differenceReason), processingCompleted: item.processingCompleted })).sort((a,b)=>a.feiTicketId.localeCompare(b.feiTicketId)) } } : {}),
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

export interface StrictSpecialCraftHandoverEventFact {
  event: CuttingRuntimeEvent<'特殊工艺交出'>
  payload: CompleteSpecialCraftHandoverPayload
  handoverRecordId: string
  bagCode: string
  usageCycleId: string
  handoverLegId: string
  handoverSequence: number
  specialCraftId: string
  canonicalIntent: string
}

/** 校验直接转交的上一实交、持有工厂及逐票数量；读取不会补造任务或完工。 */
export function listSpecialCraftHandoverFacts(events: readonly CuttingRuntimeEvent[]): StrictSpecialCraftHandoverEventFact[] {
  const result: StrictSpecialCraftHandoverEventFact[] = []
  const latest = new Map<string, StrictSpecialCraftHandoverEventFact>()
  for (const event of sortRuntimeEventSnapshot(events)) {
    const fact = parseStrictSpecialCraftHandoverEvent(event)
    if (!fact) {
      if (['特殊工艺回仓', '中转袋入仓', '中转袋回收', '中转袋重装', '菲票装袋'].includes(event.eventType)) {
        const code = text(event.refs.transferBagCode)
        if (code) latest.delete(code)
      }
      continue
    }
    const direct = fact.payload.directTransfer
    if (direct) {
      const previous = latest.get(fact.bagCode)
      if (!previous || previous.event.eventId !== direct.sourceHandoverEventId || previous.handoverRecordId !== direct.sourceHandoverRecordId
        || previous.usageCycleId !== fact.usageCycleId || previous.specialCraftId === fact.specialCraftId
        || previous.payload.receiverFactoryId !== direct.sourceFactoryId || previous.payload.receiverFactoryName !== direct.sourceFactoryName
        || previous.handoverSequence + 1 !== fact.handoverSequence
        || fact.payload.sourceInventoryEventId !== previous.payload.sourceInventoryEventId
        || fact.payload.sourceWarehouseArea !== previous.payload.sourceWarehouseArea || fact.payload.sourceLocationCode !== previous.payload.sourceLocationCode
        || JSON.stringify(fact.payload.locationRef) !== JSON.stringify(previous.payload.locationRef)
        || !sameStrings(previous.payload.ticketSnapshot.map(ticket => ticket.feiTicketId), fact.payload.ticketSnapshot.map(ticket => ticket.feiTicketId))) continue
      const items = direct.completedTicketItems
      if (!Array.isArray(items) || !sameStrings(items.map(item => item.feiTicketId), previous.payload.ticketSnapshot.map(ticket => ticket.feiTicketId))
        || new Set(items.map(item => item.feiTicketId)).size !== items.length) continue
      if (items.some(item => {
        const prior = previous.payload.ticketSnapshot.find(ticket => ticket.feiTicketId === item.feiTicketId)!
        const next = fact.payload.ticketSnapshot.find(ticket => ticket.feiTicketId === item.feiTicketId)!
        return item.specialCraftId !== previous.payload.feiTicketItems.find(priorItem => priorItem.feiTicketId === item.feiTicketId)?.specialCraftId
          || item.specialCraftId === fact.payload.feiTicketItems.find(nextItem => nextItem.feiTicketId === item.feiTicketId)?.specialCraftId || item.processingCompleted !== true
          || !Number.isSafeInteger(item.completedQty) || item.completedQty <= 0 || item.completedQty > prior.pieceQty
          || (item.completedQty !== prior.pieceQty && !text(item.differenceReason))
          || !sameWholeBagTicketSnapshot([{ ...prior, pieceQty: item.completedQty }], [next])
      })) continue
    }
    result.push(fact)
    latest.set(fact.bagCode, fact)
  }
  return result
}

export interface SpecialCraftProcessingCompletionFact {
  eventId: string
  sourceHandoverEventId: string
  sourceHandoverRecordId: string
  feiTicketId: string
  specialCraftId: string
  receiverFactoryId: string
  returnedQty: number
  processingCompleted: true
  returnedAt: string
  returnedBy: string
  directTransfer: true
}

/** 仅证明前道完成，不能作为裁床仓库存或最终回仓实收。 */
export function listSpecialCraftProcessingCompletionFacts(events?: readonly CuttingRuntimeEvent[], storage: BrowserStorageLike | null = getBrowserLocalStorage()): SpecialCraftProcessingCompletionFact[] {
  return listSpecialCraftHandoverFacts(events || listManagedCuttingRuntimeEvents(storage)).flatMap(fact => {
    const direct = fact.payload.directTransfer
    return direct ? direct.completedTicketItems.map(item => ({ eventId: fact.event.eventId, sourceHandoverEventId: direct.sourceHandoverEventId, sourceHandoverRecordId: direct.sourceHandoverRecordId, feiTicketId: item.feiTicketId, specialCraftId: item.specialCraftId, receiverFactoryId: direct.sourceFactoryId, returnedQty: item.completedQty, processingCompleted: true as const, returnedAt: fact.event.occurredAt, returnedBy: fact.event.operatorName, directTransfer: true as const })) : []
  })
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
  if (!itemTicketIds || !sameStrings(itemTicketIds, snapshotTicketIds) || !feiTicketItems.some(item => text(item.specialCraftId) === specialCraftId)) return null
  const snapshotById = new Map(ticketSnapshot.map((item) => [item.feiTicketId, item]))
  if (feiTicketItems.some((item) => {
    const snapshot = snapshotById.get(text(item.feiTicketId))
    return !snapshot
      || text(item.feiTicketNo) !== snapshot.feiTicketNo
      || !text(item.specialCraftId)
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
    || event.inventoryEffect.direction !== (payload.directTransfer ? 'ADJUST' : 'OUT')
    || event.inventoryEffect.qty !== (payload.directTransfer ? 0 : totalPieceQty)
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
    directTransfer: payload.directTransfer as CompleteSpecialCraftHandoverPayload['directTransfer'],
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
    payload: payload as unknown as CompleteSpecialCraftHandoverPayload,
    handoverRecordId,
    bagCode,
    usageCycleId,
    handoverLegId,
    handoverSequence,
    specialCraftId,
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
  const handoverBatchId = text(payload.handoverBatchId)
  const receiverPpicId = text(payload.receiverPpicId)
  const receiverPpicName = text(payload.receiverPpicName)
  const batchTargetFeiTicketIds = handoverBatchId
    ? strictRequiredStringArray(payload.targetFeiTicketIds)
    : null
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
    || (handoverBatchId && (!receiverPpicId || !receiverPpicName || !batchTargetFeiTicketIds))
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
  if (batchTargetFeiTicketIds && snapshotTicketIds.some((ticketId) => !batchTargetFeiTicketIds.includes(ticketId))) return null

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
      || MIXED_BAG_EXTRA_FIELDS.some(field => item[field] !== snapshot[field])
  })) return null

  if (
    text(event.refs.transferBagCode) !== bagCode
    || text(event.refs.usageCycleId) !== usageCycleId
    || text(event.refs.handoverOrderId) !== handoverOrderId
    || text(event.refs.handoverRecordId) !== handoverRecordId
    || text(event.refs.productionOrderId) !== productionOrderIds[0]
    || text(event.refs.productionOrderNo) !== productionOrderNos[0]
    || text(event.refs.handoverLegId) !== handoverLegId
    || (handoverBatchId && text(event.refs.handoverBatchId) !== handoverBatchId)
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
    ...(handoverBatchId ? {
      handoverContext: {
        handoverBatchId,
        productionOrderId: productionOrderIds[0],
        productionOrderNo: productionOrderNos[0],
        sewingTaskId: snapshotTaskIds[0],
        sewingTaskNo: snapshotTaskNos[0],
        receiverFactoryId: receiverId,
        receiverFactoryName: receiverName,
        receiverPpicId,
        receiverPpicName,
        targetFeiTicketIds: snapshotTicketIds,
      },
    } : {}),
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

function parseCompleteWaitHandoverLocationRef(
  value: unknown,
): RuntimeWarehouseLocationRef | null {
  const raw = record(value)
  const locationRef: RuntimeWarehouseLocationRef = {
    factoryId: text(raw.factoryId),
    warehouseId: text(raw.warehouseId),
    warehouseKind: raw.warehouseKind === 'WAIT_HANDOVER'
      ? 'WAIT_HANDOVER'
      : 'WAIT_PROCESS',
    areaId: text(raw.areaId),
    areaName: text(raw.areaName),
    shelfId: text(raw.shelfId),
    shelfNo: text(raw.shelfNo),
    locationId: text(raw.locationId),
    locationNo: text(raw.locationNo),
  }
  if (
    raw.warehouseKind !== 'WAIT_HANDOVER'
    || Object.entries(locationRef).some(([key, field]) => key !== 'warehouseKind' && !text(field))
  ) return null
  return locationRef
}

function normalizeSubmitSpecialCraftBagReturnInput(
  input: SubmitSpecialCraftBagReturnInput,
): SubmitSpecialCraftBagReturnInput & {
  occurredAt: string
  operator: TransferBagRuntimeOperator
} {
  const source = record(input)
  const returnedTicketIds = Array.isArray(source.returnedTicketIds)
    ? source.returnedTicketIds.map(text)
    : []
  if (!returnedTicketIds.length) throw new Error('空袋请执行中转袋回收。')
  if (returnedTicketIds.some((ticketId) => !ticketId)) {
    throw new Error('回仓菲票编号不能为空。')
  }
  if (new Set(returnedTicketIds).size !== returnedTicketIds.length) {
    throw new Error('回仓菲票编号不能重复。')
  }
  const locationRef = parseCompleteWaitHandoverLocationRef(source.locationRef)
  if (!locationRef) throw new Error('特殊工艺带袋回仓必须选择完整的待交出仓库位。')
  return {
    sourceHandoverRecordId: requiredText(source.sourceHandoverRecordId, '来源特殊工艺交出记录'),
    bagCode: requiredText(source.bagCode, '中转袋编号'),
    returnedTicketIds,
    ticketReceipts: Array.isArray(input.ticketReceipts) ? input.ticketReceipts : undefined,
    locationRef,
    operator: normalizedOperator(source.operator, '回仓操作人', '特殊工艺回仓员'),
    source: requiredEventSource(source.source, '回仓来源'),
    occurredAt: normalizeTransferBagOperationTime(source.occurredAt),
  }
}

export function buildSpecialCraftBagReturnCanonicalIntent(input: {
  sourceHandoverRecordId: string
  sourceHandoverEventId: string
  sourceHandoverOrderId: string
  bagCode: string
  usageCycleId: string
  handoverLegId: string
  specialCraftId: string
  receiverFactoryId: string
  receiverFactoryName: string
  craftType: string
  returnedTicketIds: string[]
  ticketSnapshot: TransferBagTicketFactSnapshot[]
  ticketReceipts?: SpecialCraftTicketReceiptInput[]
  correctionOfEventId?: string
  receiptVersion?: number
  previousReturnedQty?: number
  correctionReason?: string
  inventoryAdjusted?: boolean
  locationRef: RuntimeWarehouseLocationRef
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt: string
  idempotencyKey: string
}): string {
  return JSON.stringify({
    sourceHandoverRecordId: input.sourceHandoverRecordId,
    sourceHandoverEventId: input.sourceHandoverEventId,
    sourceHandoverOrderId: input.sourceHandoverOrderId,
    bagCode: input.bagCode,
    usageCycleId: input.usageCycleId,
    handoverLegId: input.handoverLegId,
    specialCraftId: input.specialCraftId,
    receiverFactoryId: input.receiverFactoryId,
    receiverFactoryName: input.receiverFactoryName,
    craftType: input.craftType,
    returnedTicketIds: [...input.returnedTicketIds].sort(),
    ...(input.ticketReceipts ? { ticketReceipts: input.ticketReceipts.map(item => ({ feiTicketId: text(item.feiTicketId), returnedQty: Number(item.returnedQty), differenceReason: text(item.differenceReason), ...(typeof item.processingCompleted === 'boolean' ? { processingCompleted: item.processingCompleted } : {}) })).sort((a, b) => a.feiTicketId.localeCompare(b.feiTicketId)) } : {}),
    ...(input.correctionOfEventId ? { correctionOfEventId: input.correctionOfEventId, receiptVersion: input.receiptVersion, previousReturnedQty: input.previousReturnedQty, correctionReason: input.correctionReason, ...(input.inventoryAdjusted === undefined ? {} : { inventoryAdjusted: input.inventoryAdjusted }) } : {}),
    ticketSnapshot: input.ticketSnapshot
      .map(normalizeWholeBagTicketSnapshot)
      .sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId)),
    locationRef: input.locationRef,
    operator: {
      operatorId: text(input.operator.operatorId),
      operatorName: input.operator.operatorName,
      operatorRole: text(input.operator.operatorRole) || '特殊工艺回仓员',
    },
    source: input.source,
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
  })
}

function buildSpecialCraftTicketOnlyReturnCanonicalIntent(input: {
  payload: SpecialCraftReturnPayload
  sourceHandoverEventId: string
  ticketSnapshot: TransferBagTicketFactSnapshot[]
  specialCraftId: string
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt: string
  idempotencyKey: string
}): string {
  const payload = input.payload
  const rawLocationRef = record(payload.locationRef)
  const locationRef = {
    factoryId: text(rawLocationRef.factoryId),
    warehouseId: text(rawLocationRef.warehouseId),
    warehouseKind: rawLocationRef.warehouseKind === 'WAIT_HANDOVER' ? 'WAIT_HANDOVER' : 'WAIT_PROCESS',
    areaId: text(rawLocationRef.areaId),
    areaName: text(rawLocationRef.areaName),
    shelfId: text(rawLocationRef.shelfId),
    shelfNo: text(rawLocationRef.shelfNo),
    locationId: text(rawLocationRef.locationId),
    locationNo: text(rawLocationRef.locationNo),
  }
  return JSON.stringify({
    returnRecordId: text(payload.returnRecordId),
    returnRecordNo: text(payload.returnRecordNo),
    sourceHandoverOrderId: text(payload.sourceHandoverOrderId),
    sourceHandoverOrderNo: text(payload.sourceHandoverOrderNo),
    sourceHandoverRecordId: text(payload.sourceHandoverRecordId),
    sourceHandoverRecordNo: text(payload.sourceHandoverRecordNo),
    receiverFactoryId: text(payload.receiverFactoryId),
    receiverFactoryName: text(payload.receiverFactoryName),
    warehouseName: text(payload.warehouseName),
    craftType: text(payload.craftType),
    returnedFeiTicketItems: payload.returnedFeiTicketItems
      .map((item) => ({
        feiTicketId: text(item.feiTicketId),
        feiTicketNo: text(item.feiTicketNo),
        specialCraftId: text(item.specialCraftId),
        craftType: text(item.craftType),
        partName: text(item.partName),
        size: text(item.size),
        expectedQty: item.expectedQty,
        returnedQty: item.returnedQty,
        unit: item.unit,
        returnStatus: item.returnStatus,
        ...(item.differenceReason ? { differenceReason: text(item.differenceReason) } : {}),
        ...(typeof item.processingCompleted === 'boolean' ? { processingCompleted: item.processingCompleted } : {}),
      }))
      .sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId)),
    warehouseArea: text(payload.warehouseArea),
    locationCode: text(payload.locationCode),
    locationRef,
    returnedAt: text(payload.returnedAt),
    returnedBy: text(payload.returnedBy),
    ...(payload.correctionOfEventId ? { correctionOfEventId: payload.correctionOfEventId, receiptVersion: payload.receiptVersion, previousReturnedQty: payload.previousReturnedQty, correctionReason: payload.correctionReason, ...(payload.inventoryAdjusted === undefined ? {} : { inventoryAdjusted: payload.inventoryAdjusted }) } : {}),
    sourceHandoverEventId: input.sourceHandoverEventId,
    ticketSnapshot: input.ticketSnapshot
      .map(normalizeWholeBagTicketSnapshot)
      .sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId)),
    specialCraftId: input.specialCraftId,
    operator: {
      operatorId: text(input.operator.operatorId),
      operatorName: input.operator.operatorName,
      operatorRole: text(input.operator.operatorRole) || '特殊工艺回仓员',
    },
    source: input.source,
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
  })
}

function receivedTicketSnapshots(payload: CompleteSpecialCraftBagReturnPayload): TransferBagTicketFactSnapshot[] {
  const quantities = new Map(payload.returnedFeiTicketItems.map(item => [item.feiTicketId, item.returnedQty]))
  return payload.ticketSnapshot.map(ticket => ({ ...ticket, pieceQty: quantities.get(ticket.feiTicketId) ?? 0 })).filter(ticket => ticket.pieceQty > 0)
}

export interface SpecialCraftTicketReturnFact {
  eventId: string
  returnRecordNo?: string
  sourceHandoverRecordId: string
  sourceHandoverEventId: string
  sourceHandoverOrderNo?: string
  sourceHandoverRecordNo?: string
  feiTicketId: string
  feiTicketNo: string
  specialCraftId: string
  craftType: string
  receiverFactoryId: string
  returnedQty: number
  expectedQty: number
  differenceReason: string
  processingCompleted: true | null
  correctionOfEventId?: string
  receiptVersion: number
  returnedAt: string
  /** 更正只更新数量依据，实物原回仓时间用于核对加工先后。 */
  originalReturnedAt?: string
  returnedBy: string
  locationRef: RuntimeWarehouseLocationRef
}

/** 一张票一道工艺只返回最新有效实收；更正替代原量，不把多道回仓相加。 */
export function listSpecialCraftTicketReturnFacts(
  events?: readonly CuttingRuntimeEvent[],
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): SpecialCraftTicketReturnFact[] {
  const snapshot = sortRuntimeEventSnapshot(events ? [...events] : listManagedCuttingRuntimeEvents(storage))
  const compareChronology = createCuttingRuntimeChronologyComparator(snapshot)
  // 本次完整投影的交出事实统一严格核对；历史回仓与更正共用其原交出，避免逐条重扫全账。
  const sourcesByRecord = new Map<string, StrictSpecialCraftHandoverEventFact[]>()
  for (const source of listSpecialCraftHandoverFacts(snapshot)) {
    for (const id of new Set([text(source.event.refs.handoverRecordId), text(source.payload.handoverRecordId)])) {
      if (id) sourcesByRecord.set(id, [...(sourcesByRecord.get(id) || []), source])
    }
  }
  const accepted = new Map<string, CuttingRuntimeEvent<'特殊工艺回仓'>>()
  const result = new Map<string, SpecialCraftTicketReturnFact>()
  for (const event of snapshot) {
    const bagReturn = parseStrictSpecialCraftBagReturnEvent(event)
    const parsed = bagReturn || parseStrictSpecialCraftTicketOnlyReturnEvent(event)
    if (!parsed) continue
    const payload = parsed.payload
    const sources = sourcesByRecord.get(payload.sourceHandoverRecordId) || []
    const source = sources.length === 1 ? sources[0] : null
    if (!source || source.event.eventId !== payload.sourceHandoverEventId || compareChronology(event, source.event) <= 0) continue
    if (payload.sourceHandoverOrderId !== source.payload.handoverOrderId
      || payload.receiverFactoryId !== source.payload.receiverFactoryId
      || payload.receiverFactoryName !== source.payload.receiverFactoryName
      || payload.craftType !== source.payload.craftType) continue
    if (bagReturn && !sameStrings(source.payload.ticketSnapshot.map(ticket => ticket.feiTicketId), payload.returnedFeiTicketItems.map(ticket => ticket.feiTicketId))) continue
    if (payload.correctionOfEventId) {
      const previous = accepted.get(payload.correctionOfEventId)
      const prior = previous?.payload as CompleteSpecialCraftBagReturnPayload | CompleteSpecialCraftTicketOnlyReturnPayload | undefined
      if (!prior || prior.sourceHandoverRecordId !== payload.sourceHandoverRecordId
        || !sameWholeBagTicketSnapshot(prior.ticketSnapshot, payload.ticketSnapshot)
        || payload.receiptVersion !== (prior.receiptVersion || 1) + 1
        || payload.previousReturnedQty !== prior.returnedFeiTicketItems.reduce((sum, item) => sum + item.returnedQty, 0)
        || prior.returnedFeiTicketItems.some(item => result.get(`${item.feiTicketId}:${item.specialCraftId}`)?.eventId !== previous!.eventId)) continue
    }
    if (payload.returnedFeiTicketItems.some(ticket => !source.payload.ticketSnapshot.some(sourceTicket => sourceTicket.feiTicketId === ticket.feiTicketId))) continue
    const sourceById = new Map(source.payload.ticketSnapshot.map(ticket => [ticket.feiTicketId, ticket]))
    if (!sameWholeBagTicketSnapshot(source.payload.ticketSnapshot.filter(ticket => payload.ticketSnapshot.some(item => item.feiTicketId === ticket.feiTicketId)), payload.ticketSnapshot)) continue
    if (payload.returnedFeiTicketItems.some(item => item.specialCraftId !== source.payload.feiTicketItems.find(sourceItem => sourceItem.feiTicketId === item.feiTicketId)?.specialCraftId || sourceById.get(item.feiTicketId)?.pieceQty !== item.expectedQty)) continue
    const locationRef = parseCompleteWaitHandoverLocationRef(payload.locationRef)
    if (!locationRef || (source.payload.locationRef?.factoryId && locationRef.factoryId !== source.payload.locationRef.factoryId)) continue
    accepted.set(event.eventId, event as CuttingRuntimeEvent<'特殊工艺回仓'>)
    for (const item of payload.returnedFeiTicketItems) result.set(`${item.feiTicketId}:${item.specialCraftId}`, {
      eventId: event.eventId, sourceHandoverRecordId: payload.sourceHandoverRecordId,
      ...(text(payload.returnRecordNo) ? { returnRecordNo: text(payload.returnRecordNo) } : {}),
      ...(text(payload.sourceHandoverOrderNo) ? { sourceHandoverOrderNo: text(payload.sourceHandoverOrderNo) } : {}),
      ...(text(payload.sourceHandoverRecordNo) ? { sourceHandoverRecordNo: text(payload.sourceHandoverRecordNo) } : {}),
      sourceHandoverEventId: payload.sourceHandoverEventId, feiTicketId: item.feiTicketId,
      feiTicketNo: item.feiTicketNo, specialCraftId: item.specialCraftId,
      craftType: item.craftType || payload.craftType || '', receiverFactoryId: payload.receiverFactoryId,
      expectedQty: item.expectedQty, returnedQty: item.returnedQty, differenceReason: item.differenceReason || '',
      processingCompleted: item.processingCompleted === true ? true : null,
      correctionOfEventId: payload.correctionOfEventId, receiptVersion: payload.receiptVersion || 1,
      returnedAt: payload.returnedAt, originalReturnedAt: payload.correctionOfEventId
        ? result.get(`${item.feiTicketId}:${item.specialCraftId}`)?.originalReturnedAt || result.get(`${item.feiTicketId}:${item.specialCraftId}`)?.returnedAt || payload.returnedAt
        : payload.returnedAt, returnedBy: payload.returnedBy, locationRef,
    })
  }
  return [...result.values()]
}

export interface SpecialCraftReturnSourceCandidate {
  sourceHandoverRecordId: string
  sourceHandoverEventId: string
  bagCode: string
  specialCraftId: string
  ticketStageIds: Record<string, string>
  craftType: string
  receiverFactoryId: string
  receiverFactoryName: string
  ticketSnapshot: TransferBagTicketFactSnapshot[]
  correctionOfEventId?: string
  receiptVersion?: number
  priorReceipts?: SpecialCraftTicketReturnFact[]
}

export function listSpecialCraftReturnSourceCandidates(
  events?: readonly CuttingRuntimeEvent[],
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): SpecialCraftReturnSourceCandidate[] {
  const snapshot = events ? [...events] : listManagedCuttingRuntimeEvents(storage)
  const receipts = listSpecialCraftTicketReturnFacts(snapshot, storage)
  const validHandovers = new Set(listSpecialCraftHandoverFacts(snapshot).map(fact => fact.event.eventId))
  return snapshot.flatMap(event => {
    const source = validHandovers.has(event.eventId) ? parseStrictSpecialCraftHandoverEvent(event) : null
    if (!source) return []
    if (source.payload.ticketSnapshot.some(ticket => !isCutPieceTicketUsable(ticket.feiTicketId))) return []
    const current = resolveTransferBagCurrentUseFromSnapshot(source.bagCode, snapshot)
    const priorReceipts = receipts.filter(receipt => receipt.sourceHandoverRecordId === source.handoverRecordId)
    const active = !priorReceipts.length && current.usageCycleId === source.usageCycleId && current.latestHandoverEventId === event.eventId && current.flowStage === 'HANDED_OVER_WAITING_RETURN'
    const base = { sourceHandoverRecordId: source.handoverRecordId, sourceHandoverEventId: event.eventId,
      bagCode: source.bagCode, specialCraftId: source.specialCraftId, ticketStageIds: Object.fromEntries(source.payload.feiTicketItems.map(item => [item.feiTicketId, item.specialCraftId])), craftType: source.payload.craftType,
      receiverFactoryId: source.payload.receiverFactoryId, receiverFactoryName: source.payload.receiverFactoryName,
      ticketSnapshot: source.payload.ticketSnapshot.map(ticket => ({ ...ticket })) }
    if (active) return [base]
    const groups = new Map<string, SpecialCraftTicketReturnFact[]>()
    priorReceipts.forEach(receipt => groups.set(receipt.eventId, [...(groups.get(receipt.eventId) || []), receipt]))
    return [...groups.values()].map(receipts => ({ ...base,
      ticketSnapshot: base.ticketSnapshot.filter(ticket => receipts.some(receipt => receipt.feiTicketId === ticket.feiTicketId)),
      correctionOfEventId: receipts[0].eventId, receiptVersion: receipts[0].receiptVersion, priorReceipts: receipts }))
  })
}

function parseStrictSpecialCraftTicketOnlyReturnEvent(event: CuttingRuntimeEvent): {
  event: CuttingRuntimeEvent<'特殊工艺回仓'>
  payload: CompleteSpecialCraftTicketOnlyReturnPayload
  canonicalIntent: string
} | null {
  if (event.eventType !== '特殊工艺回仓' || !isSuccessfulRuntimeEvent(event)) return null
  const payload = eventPayload(event)
  if (
    text(payload.transferBagCode)
    || text(payload.bagCode)
    || text(payload.usageCycleId)
    || text(payload.handoverLegId)
    || text(event.refs.transferBagCode)
    || (event.refs.transferBagCodes?.length || 0) > 0
    || text(event.refs.usageCycleId)
    || text(event.refs.handoverLegId)
  ) return null
  const sourceHandoverEventId = text(payload.sourceHandoverEventId)
  const idempotencyKey = text(payload.idempotencyKey)
  const specialCraftId = text(event.refs.specialCraftId)
  const sourceHandoverRecordId = text(payload.sourceHandoverRecordId)
  const sourceHandoverOrderId = text(payload.sourceHandoverOrderId)
  const locationRef = parseCompleteWaitHandoverLocationRef(payload.locationRef)
  const rawSnapshot = records(payload.ticketSnapshot)
  const returnedItems = records(payload.returnedFeiTicketItems)
  if (
    !sourceHandoverEventId
    || !idempotencyKey
    || !specialCraftId
    || !sourceHandoverRecordId
    || !sourceHandoverOrderId
    || !locationRef
    || !text(payload.returnRecordId)
    || !text(payload.returnRecordNo)
    || !text(payload.sourceHandoverOrderNo)
    || !text(payload.sourceHandoverRecordNo)
    || !text(payload.receiverFactoryId)
    || !text(payload.receiverFactoryName)
    || !text(payload.warehouseName)
    || !text(payload.craftType)
    || !text(payload.warehouseArea)
    || !text(payload.locationCode)
    || !text(payload.returnedAt)
    || !text(payload.returnedBy)
    || !rawSnapshot.length
    || !returnedItems.length
  ) return null
  const ticketSnapshot = rawSnapshot.map((item) =>
    normalizeWholeBagTicketSnapshot(item as unknown as TransferBagTicketFactSnapshot))
  if (ticketSnapshot.some((item) => SPECIAL_CRAFT_SNAPSHOT_REQUIRED_FIELDS.some((field) =>
    field === 'pieceQty'
      ? !Number.isFinite(item.pieceQty) || item.pieceQty <= 0
      : !text(item[field])))) return null
  const snapshotIds = strictRequiredStringArray(ticketSnapshot.map((item) => item.feiTicketId))
  const snapshotNos = strictRequiredStringArray(ticketSnapshot.map((item) => item.feiTicketNo))
  const returnedIds = strictRequiredStringArray(returnedItems.map((item) => item.feiTicketId))
  if (!snapshotIds || !snapshotNos || !returnedIds || !sameStrings(snapshotIds, returnedIds)) return null
  const ticketById = new Map(ticketSnapshot.map((item) => [item.feiTicketId, item]))
  if (returnedItems.some((item) => {
    const ticket = ticketById.get(text(item.feiTicketId))
    return !ticket
      || text(item.feiTicketNo) !== ticket.feiTicketNo
      || !text(item.specialCraftId)
      || text(item.craftType) !== text(payload.craftType)
      || text(item.partName) !== ticket.partName
      || text(item.size) !== ticket.size
      || item.expectedQty !== ticket.pieceQty
      || !Number.isSafeInteger(item.returnedQty) || Number(item.returnedQty) < 0 || Number(item.returnedQty) > ticket.pieceQty
      || (item.returnedQty !== ticket.pieceQty && !text(item.differenceReason))
      || item.unit !== '片'
      || !['已回仓', '回仓差异'].includes(text(item.returnStatus))
      || (item.returnedQty === ticket.pieceQty ? item.returnStatus !== '已回仓' : item.returnStatus !== '回仓差异')
  })) return null
  if (
    event.idempotencyKey !== idempotencyKey
    || (!text(payload.correctionOfEventId) && idempotencyKey !== `${sourceHandoverRecordId}:SPECIAL_CRAFT_TICKET_ONLY_RETURNED` && idempotencyKey !== `${sourceHandoverRecordId}:${snapshotIds.slice().sort().join('|')}:SPECIAL_CRAFT_TICKET_ONLY_RETURNED`)
    || event.refs.handoverOrderId !== sourceHandoverOrderId
    || event.refs.handoverRecordId !== sourceHandoverRecordId
    || !sameStrings(event.refs.feiTicketIds || [], snapshotIds)
    || !sameStrings(event.refs.feiTicketNos || [], snapshotNos)
    || event.inventoryEffect?.inventoryScope !== '裁床待交出仓'
    || event.inventoryEffect.direction !== (text(payload.correctionOfEventId) ? 'ADJUST' : 'IN')
    || event.inventoryEffect.qty !== (payload.correctionOfEventId && payload.inventoryAdjusted === false ? 0 : returnedItems.reduce((sum, item) => sum + Number(item.returnedQty), 0) - (text(payload.correctionOfEventId) ? Number(payload.previousReturnedQty) : 0))
    || event.inventoryEffect.unit !== '片'
    || text(event.inventoryEffect.toWarehouseArea) !== text(payload.warehouseArea)
    || text(event.inventoryEffect.toLocationCode) !== text(payload.locationCode)
    || locationRef.areaName !== text(payload.warehouseArea)
    || locationRef.locationNo !== text(payload.locationCode)
    || text(payload.returnedAt) !== event.occurredAt
    || text(payload.returnedBy) !== event.operatorName
  ) return null
  const canonicalIntent = buildSpecialCraftTicketOnlyReturnCanonicalIntent({
    payload: payload as unknown as SpecialCraftReturnPayload,
    sourceHandoverEventId,
    ticketSnapshot,
    specialCraftId,
    operator: {
      operatorId: event.operatorId,
      operatorName: event.operatorName,
      operatorRole: event.operatorRole,
    },
    source: event.eventSource,
    occurredAt: event.occurredAt,
    idempotencyKey,
  })
  if (text(payload.canonicalIntent) !== canonicalIntent) return null
  return {
    event: event as CuttingRuntimeEvent<'特殊工艺回仓'>,
    payload: payload as unknown as CompleteSpecialCraftTicketOnlyReturnPayload,
    canonicalIntent,
  }
}

function parseStrictSpecialCraftBagReturnEvent(event: CuttingRuntimeEvent): {
  event: CuttingRuntimeEvent<'特殊工艺回仓'>
  payload: CompleteSpecialCraftBagReturnPayload
  sourceHandoverRecordId: string
  sourceHandoverEventId: string
  bagCode: string
  usageCycleId: string
  handoverLegId: string
  ticketSnapshot: TransferBagTicketFactSnapshot[]
  canonicalIntent: string
} | null {
  if (
    event.eventType !== '特殊工艺回仓'
    || !isSuccessfulRuntimeEvent(event)
  ) return null
  const payload = eventPayload(event)
  const sourceHandoverRecordId = text(payload.sourceHandoverRecordId)
  const sourceHandoverEventId = text(payload.sourceHandoverEventId)
  const sourceHandoverOrderId = text(payload.sourceHandoverOrderId)
  const bagCode = text(payload.bagCode) || text(payload.transferBagCode)
  const usageCycleId = text(payload.usageCycleId)
  const handoverLegId = text(payload.handoverLegId)
  const specialCraftId = text(event.refs.specialCraftId)
  const receiverFactoryId = text(payload.receiverFactoryId)
  const receiverFactoryName = text(payload.receiverFactoryName)
  const craftType = text(payload.craftType)
  const returnedAt = text(payload.returnedAt)
  const returnedBy = text(payload.returnedBy)
  const idempotencyKey = text(payload.idempotencyKey)
  const locationRef = parseCompleteWaitHandoverLocationRef(payload.locationRef)
  const authoritativeLocation = parseTransferBagAuthoritativeLocationFact(event)
  if (
    !sourceHandoverRecordId
    || !sourceHandoverEventId
    || !sourceHandoverOrderId
    || !bagCode
    || !usageCycleId
    || parseHandoverLegSequence(usageCycleId, handoverLegId) === null
    || !specialCraftId
    || !receiverFactoryId
    || !receiverFactoryName
    || !craftType
    || !returnedAt
    || !returnedBy
    || !idempotencyKey
    || !locationRef
    || !authoritativeLocation?.locationRef
  ) return null

  const rawSnapshot = records(payload.ticketSnapshot)
  if (!rawSnapshot.length) return null
  const ticketSnapshot = rawSnapshot.map((item) =>
    normalizeWholeBagTicketSnapshot(item as unknown as TransferBagTicketFactSnapshot))
  if (ticketSnapshot.some((item) =>
    SPECIAL_CRAFT_SNAPSHOT_REQUIRED_FIELDS.some((field) => field === 'pieceQty'
      ? !Number.isFinite(item.pieceQty) || item.pieceQty <= 0
      : !text(item[field])))) return null
  const ticketIds = strictRequiredStringArray(ticketSnapshot.map((item) => item.feiTicketId))
  const ticketNos = strictRequiredStringArray(ticketSnapshot.map((item) => item.feiTicketNo))
  if (!ticketIds || !ticketNos) return null
  const returnedItems = records(payload.returnedFeiTicketItems)
  const returnedIds = strictRequiredStringArray(returnedItems.map((item) => item.feiTicketId))
  if (!returnedIds || !sameStrings(returnedIds, ticketIds)) return null
  const ticketById = new Map(ticketSnapshot.map((item) => [item.feiTicketId, item]))
  if (returnedItems.some((item) => {
    const ticket = ticketById.get(text(item.feiTicketId))
    return !ticket
      || text(item.feiTicketNo) !== ticket.feiTicketNo
      || !text(item.specialCraftId)
      || item.expectedQty !== ticket.pieceQty
      || !Number.isSafeInteger(item.returnedQty) || Number(item.returnedQty) < 0 || Number(item.returnedQty) > ticket.pieceQty
      || (item.returnedQty !== ticket.pieceQty && !text(item.differenceReason))
      || item.unit !== '片'
      || !['已回仓', '回仓差异'].includes(text(item.returnStatus))
      || (item.returnedQty === ticket.pieceQty ? item.returnStatus !== '已回仓' : item.returnStatus !== '回仓差异')
  })) return null
  const totalPieceQty = payload.correctionOfEventId && payload.inventoryAdjusted === false ? 0 : returnedItems.reduce((sum, item) => sum + Number(item.returnedQty), 0) - (text(payload.correctionOfEventId) ? Number(payload.previousReturnedQty) : 0)
  if (
    event.idempotencyKey !== idempotencyKey
    || (!text(payload.correctionOfEventId) && idempotencyKey !== `${sourceHandoverRecordId}:${usageCycleId}:SPECIAL_CRAFT_BAG_RETURNED`)
    || event.refs.handoverOrderId !== sourceHandoverOrderId
    || event.refs.handoverRecordId !== sourceHandoverRecordId
    || event.refs.transferBagCode !== bagCode
    || event.refs.usageCycleId !== usageCycleId
    || event.refs.handoverLegId !== handoverLegId
    || !sameStrings(event.refs.feiTicketIds || [], ticketIds)
    || !sameStrings(event.refs.feiTicketNos || [], ticketNos)
    || event.inventoryEffect?.inventoryScope !== '裁床待交出仓'
    || event.inventoryEffect.direction !== (text(payload.correctionOfEventId) ? 'ADJUST' : 'IN')
    || event.inventoryEffect.qty !== totalPieceQty
    || event.inventoryEffect.unit !== '片'
    || returnedAt !== event.occurredAt
    || returnedBy !== event.operatorName
  ) return null
  const canonicalIntent = buildSpecialCraftBagReturnCanonicalIntent({
    sourceHandoverRecordId,
    sourceHandoverEventId,
    sourceHandoverOrderId,
    bagCode,
    usageCycleId,
    handoverLegId,
    specialCraftId,
    receiverFactoryId,
    receiverFactoryName,
    craftType,
    returnedTicketIds: returnedIds,
    ...(payload.receiptVersion ? { ticketReceipts: returnedItems.map(item => ({ feiTicketId: text(item.feiTicketId), returnedQty: Number(item.returnedQty), differenceReason: text(item.differenceReason), ...(typeof item.processingCompleted === 'boolean' ? { processingCompleted: item.processingCompleted } : {}) })) } : {}),
    correctionOfEventId: text(payload.correctionOfEventId),
    receiptVersion: Number(payload.receiptVersion) || undefined,
    previousReturnedQty: Number(payload.previousReturnedQty),
    correctionReason: text(payload.correctionReason) || undefined,
    inventoryAdjusted: typeof payload.inventoryAdjusted === 'boolean' ? payload.inventoryAdjusted : undefined,
    ticketSnapshot,
    locationRef,
    operator: {
      operatorId: event.operatorId,
      operatorName: event.operatorName,
      operatorRole: event.operatorRole,
    },
    source: event.eventSource,
    occurredAt: event.occurredAt,
    idempotencyKey,
  })
  if (text(payload.canonicalIntent) !== canonicalIntent) return null
  return {
    event: event as CuttingRuntimeEvent<'特殊工艺回仓'>,
    payload: payload as unknown as CompleteSpecialCraftBagReturnPayload,
    sourceHandoverRecordId,
    sourceHandoverEventId,
    bagCode,
    usageCycleId,
    handoverLegId,
    ticketSnapshot,
    canonicalIntent,
  }
}

export function isCompleteSuccessfulSpecialCraftBagReturnEvent(
  event: CuttingRuntimeEvent,
): boolean {
  return Boolean(parseStrictSpecialCraftBagReturnEvent(event))
}

function buildCurrentTicketBagIndexFromSnapshot(
  snapshotEvents: readonly CuttingRuntimeEvent[],
): Map<string, string> {
  const states = new Map<string, TransferBagCurrentUse>()
  const bagsWithRepackFacts = new Set<string>()
  const stateFor = (bagCode: string) => states.get(bagCode) || emptyCurrentUse(bagCode)
  const update = (bagCode: string, state: TransferBagCurrentUse) => states.set(bagCode, state)
  const events = sortRuntimeEventSnapshot(snapshotEvents)

  for (const event of events) {
    const payload = eventPayload(event)
    if (event.eventType === '菲票装袋') {
      const bagCode = text(payload.bagCode) || text(event.refs.transferBagCode)
      if (!bagCode || stateFor(bagCode).mainStatus === 'DISABLED') continue
      const tickets = records(payload.feiTicketItems).map((item) => ticketSnapshot(item, event))
      update(bagCode, {
        ...stateFor(bagCode),
        usageCycleId: eventUsageCycleId(event) || `usage:${bagCode}:${event.eventId}`,
        tickets,
        mainStatus: 'IN_USE',
        flowStage: 'PACKED',
      })
      continue
    }
    if (event.eventType === '中转袋入仓') {
      const bagCode = text(payload.bagCode) || text(event.refs.transferBagCode)
      if (!bagCode || stateFor(bagCode).mainStatus === 'DISABLED') continue
      update(bagCode, {
        ...stateFor(bagCode),
        usageCycleId: eventUsageCycleId(event) || stateFor(bagCode).usageCycleId,
        mainStatus: 'IN_USE',
        flowStage: 'INBOUND_STORED',
      })
      continue
    }
    if (event.eventType === '中转袋拆袋重装') {
      const repack = parseCompleteTransferBagRepackPayload(event)
      if (!repack) continue
      for (const sourceBag of repack.sourceBags) {
        bagsWithRepackFacts.add(sourceBag.bagCode)
        if (sourceBag.outcome === 'RETURN_INBOUND') {
          update(sourceBag.bagCode, {
            ...stateFor(sourceBag.bagCode),
            usageCycleId: sourceBag.usageCycleId,
            tickets: (sourceBag.afterTickets || []).map((item) => ({ ...item })),
            mainStatus: 'IN_USE',
            flowStage: 'PACKED',
          })
        } else if (sourceBag.outcome !== 'RESULT_HANDOVER') {
          update(sourceBag.bagCode, emptyCurrentUse(sourceBag.bagCode))
        }
      }
      for (const resultBag of repack.resultBags) {
        bagsWithRepackFacts.add(resultBag.bagCode)
        const tickets = resultBag.tickets.map((item) => ({ ...item }))
        update(resultBag.bagCode, {
          ...stateFor(resultBag.bagCode),
          usageCycleId: resultBag.usageCycleId,
          tickets,
          mainStatus: 'IN_USE',
          flowStage: 'READY_HANDOVER',
        })
      }
      continue
    }
    if (event.eventType === '交出装袋确认') {
      const sourceBagCode = text(payload.sourceTempBagCode)
      const targetBagCode = text(payload.targetTransferBagCode)
      if (!sourceBagCode || !targetBagCode) continue
      const source = stateFor(sourceBagCode)
      const expectedIds = unique([
        ...strings(payload.containedFeiTicketIds),
        ...strings(payload.scannedFeiTicketIds),
        ...(event.refs.feiTicketIds || []),
      ])
      const recovered = source.tickets.length
        && expectedIds.length
        && sameStrings(source.tickets.map((ticket) => ticket.feiTicketId), expectedIds)
        ? source.tickets.map((ticket) => ({ ...ticket }))
        : null
      if (!recovered) continue
      if (!bagsWithRepackFacts.has(sourceBagCode)) update(sourceBagCode, emptyCurrentUse(sourceBagCode))
      if (!bagsWithRepackFacts.has(targetBagCode)) {
        update(targetBagCode, {
          ...stateFor(targetBagCode),
          usageCycleId: eventUsageCycleId(event) || stateFor(targetBagCode).usageCycleId,
          tickets: recovered,
          mainStatus: 'IN_USE',
          flowStage: 'READY_HANDOVER',
        })
      }
      continue
    }
    if (event.eventType === '新增交出记录' || event.eventType === '特殊工艺交出') {
      const handover = event.eventType === '新增交出记录'
        ? parseStrictWholeBagHandoverEvent(event)
        : parseStrictSpecialCraftHandoverEvent(event)
      if (!handover) continue
      const current = stateFor(handover.bagCode)
      if (current.usageCycleId !== handover.usageCycleId) continue
      update(handover.bagCode, {
        ...current,
        tickets: [],
        mainStatus: 'IN_USE',
        flowStage: 'HANDED_OVER_WAITING_RETURN',
        latestHandoverEventId: handover.event.eventId,
      })
      continue
    }
    if (event.eventType === '特殊工艺回仓') {
      const returned = parseStrictSpecialCraftBagReturnEvent(event)
      if (!returned) continue
      if (returned.payload.correctionOfEventId && returned.payload.inventoryAdjusted === false) continue
      const current = stateFor(returned.bagCode)
      if (
        current.usageCycleId !== returned.usageCycleId
        || current.latestHandoverEventId !== returned.sourceHandoverEventId
        || (current.flowStage !== 'HANDED_OVER_WAITING_RETURN' && !(returned.payload.correctionOfEventId && current.flowStage === 'INBOUND_STORED'))
      ) continue
      update(returned.bagCode, {
        ...current,
        tickets: receivedTicketSnapshots(returned.payload),
        mainStatus: 'IN_USE',
        flowStage: 'INBOUND_STORED',
      })
      continue
    }
    if (event.eventType === '中转袋回收') {
      const bagCode = text(payload.bagCode) || text(event.refs.transferBagCode)
      if (!bagCode) continue
      const current = stateFor(bagCode)
      const recovery = parseCompleteRecoveryEvent(event)
      const matchesCurrentCycle = Boolean(current.usageCycleId && (
        recovery?.payload.usageCycleId === current.usageCycleId
        || isCompleteLegacyRecoveryEvent(event, bagCode, current.usageCycleId)
      ))
      if (current.flowStage === 'HANDED_OVER_WAITING_RETURN' && matchesCurrentCycle) {
        update(bagCode, emptyCurrentUse(bagCode))
      }
      continue
    }
    if (event.eventType === '中转袋报废') {
      const bagCode = text(payload.bagCode) || text(event.refs.transferBagCode)
      if (!bagCode) continue
      const current = stateFor(bagCode)
      if (
        current.mainStatus === 'IDLE'
        && current.tickets.length === 0
        && (Boolean(parseCompleteScrapEvent(event)) || isCompleteLegacyScrapEvent(event, bagCode))
      ) update(bagCode, { ...emptyCurrentUse(bagCode), mainStatus: 'DISABLED' })
    }
  }

  const index = new Map<string, string>()
  for (const [bagCode, state] of states) {
    for (const ticket of state.tickets) index.set(ticket.feiTicketId, bagCode)
  }
  return index
}

function specialCraftHandoverCandidates(
  events: readonly CuttingRuntimeEvent[],
  sourceHandoverRecordId: string,
): CuttingRuntimeEvent[] {
  return listSpecialCraftHandoverFacts(events).map(fact => fact.event).filter((event) => event.eventType === '特殊工艺交出'
    && (
      text(event.refs.handoverRecordId) === sourceHandoverRecordId
      || text(eventPayload(event).handoverRecordId) === sourceHandoverRecordId
    ))
}

function buildSpecialCraftBagReturnAppendInput(input: {
  request: ReturnType<typeof normalizeSubmitSpecialCraftBagReturnInput>
  sourceFact: StrictSpecialCraftHandoverEventFact
}): AppendCuttingRuntimeEventInput<'特殊工艺回仓'> & { idempotencyKey: string } {
  const { request, sourceFact } = input
  const sourcePayload = sourceFact.payload
  const sourceItemsById = new Map(sourcePayload.feiTicketItems.map((item) => [item.feiTicketId, item]))
  const ticketSnapshot = sourcePayload.ticketSnapshot.map((item) => ({ ...item }))
  const receipts = validateSpecialCraftTicketReceipts(ticketSnapshot, request.ticketReceipts)
  const receiptById = new Map(receipts.map(receipt => [receipt.feiTicketId, receipt]))
  const idempotencyKey = `${sourceFact.handoverRecordId}:${sourceFact.usageCycleId}:SPECIAL_CRAFT_BAG_RETURNED`
  const canonicalIntent = buildSpecialCraftBagReturnCanonicalIntent({
    sourceHandoverRecordId: sourceFact.handoverRecordId,
    sourceHandoverEventId: sourceFact.event.eventId,
    sourceHandoverOrderId: sourcePayload.handoverOrderId,
    bagCode: sourceFact.bagCode,
    usageCycleId: sourceFact.usageCycleId,
    handoverLegId: sourceFact.handoverLegId,
    specialCraftId: sourceFact.specialCraftId,
    receiverFactoryId: sourcePayload.receiverFactoryId,
    receiverFactoryName: sourcePayload.receiverFactoryName,
    craftType: sourcePayload.craftType,
    returnedTicketIds: request.returnedTicketIds,
    ticketSnapshot,
    ticketReceipts: receipts,
    locationRef: request.locationRef,
    operator: request.operator,
    source: request.source,
    occurredAt: request.occurredAt,
    idempotencyKey,
  })
  const returnedFeiTicketItems: SpecialCraftReturnPayload['returnedFeiTicketItems'] = ticketSnapshot.map((ticket) => {
    const sourceItem = sourceItemsById.get(ticket.feiTicketId)
    return {
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      specialCraftId: sourceItem!.specialCraftId,
      craftType: sourcePayload.craftType,
      partName: ticket.partName,
      size: ticket.size,
      expectedQty: ticket.pieceQty,
      returnedQty: receiptById.get(ticket.feiTicketId)!.returnedQty,
      differenceReason: receiptById.get(ticket.feiTicketId)!.differenceReason,
      processingCompleted: receiptById.get(ticket.feiTicketId)!.processingCompleted,
      unit: '片',
      returnStatus: receiptById.get(ticket.feiTicketId)!.returnedQty === ticket.pieceQty ? '已回仓' : '回仓差异',
      ...(sourceItem?.partName ? { partName: sourceItem.partName } : {}),
    }
  })
  const payload: CompleteSpecialCraftBagReturnPayload = {
    returnRecordId: `SPECIAL-RETURN:${sourceFact.handoverRecordId}:${sourceFact.usageCycleId}`,
    returnRecordNo: `特殊工艺回仓-${sourceFact.handoverRecordId}`,
    sourceHandoverOrderId: sourcePayload.handoverOrderId,
    sourceHandoverOrderNo: sourcePayload.handoverOrderId,
    sourceHandoverRecordId: sourceFact.handoverRecordId,
    sourceHandoverRecordNo: sourceFact.handoverRecordId,
    receiverFactoryId: sourcePayload.receiverFactoryId,
    receiverFactoryName: sourcePayload.receiverFactoryName,
    transferBagCode: sourceFact.bagCode,
    warehouseName: '裁床待交出仓',
    craftType: sourcePayload.craftType,
    returnedFeiTicketItems,
    receiptVersion: 1,
    warehouseArea: request.locationRef.areaName,
    locationCode: request.locationRef.locationNo,
    locationRef: { ...request.locationRef },
    returnedAt: request.occurredAt,
    returnedBy: request.operator.operatorName,
    canonicalIntent,
    bagCode: sourceFact.bagCode,
    usageCycleId: sourceFact.usageCycleId,
    handoverLegId: sourceFact.handoverLegId,
    sourceHandoverEventId: sourceFact.event.eventId,
    ticketSnapshot,
    idempotencyKey,
  }
  return {
    idempotencyKey,
    eventType: '特殊工艺回仓',
    eventSource: request.source,
    eventStatus: '已同步',
    occurredAt: request.occurredAt,
    operatorId: request.operator.operatorId,
    operatorName: request.operator.operatorName,
    operatorRole: request.operator.operatorRole,
    refs: {
      handoverOrderId: sourcePayload.handoverOrderId,
      handoverRecordId: sourceFact.handoverRecordId,
      specialCraftId: sourceFact.specialCraftId,
      feiTicketIds: ticketSnapshot.map((ticket) => ticket.feiTicketId),
      feiTicketNos: ticketSnapshot.map((ticket) => ticket.feiTicketNo),
      transferBagCode: sourceFact.bagCode,
      usageCycleId: sourceFact.usageCycleId,
      handoverLegId: sourceFact.handoverLegId,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'IN',
      qty: receipts.reduce((sum, receipt) => sum + receipt.returnedQty, 0),
      unit: '片',
      toWarehouseArea: request.locationRef.areaName,
      toLocationCode: request.locationRef.locationNo,
    },
    payload,
  }
}

export function submitSpecialCraftBagReturn(
  input: SubmitSpecialCraftBagReturnInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<'特殊工艺回仓'> {
  const prior = !input.occurredAt ? listManagedCuttingRuntimeEvents(storage).find(event => event.eventType === '特殊工艺回仓' && event.refs.handoverRecordId === input.sourceHandoverRecordId && event.refs.transferBagCode === input.bagCode && !(event.payload as SpecialCraftReturnPayload).correctionOfEventId) : null
  const request = normalizeSubmitSpecialCraftBagReturnInput({ ...input, occurredAt: input.occurredAt || prior?.occurredAt })
  let expectedCanonicalIntent = ''
  const result = appendCuttingRuntimeEventIdempotentValidated<'特殊工艺回仓'>(
    (snapshotEvents) => {
      const events = [...snapshotEvents]
      const candidates = specialCraftHandoverCandidates(events, request.sourceHandoverRecordId)
      const sourceFact = candidates.length === 1
        ? parseStrictSpecialCraftHandoverEvent(candidates[0])
        : null
      if (!sourceFact) {
        throw new Error('来源特殊工艺交出记录不存在、未成功或事实不完整。')
      }
      if (sourceFact.bagCode !== request.bagCode) {
        throw new Error('回仓中转袋与来源特殊工艺交出记录不一致。')
      }
      if (sourceFact.payload.locationRef?.factoryId && request.locationRef.factoryId !== sourceFact.payload.locationRef.factoryId) throw new Error('回仓库位不属于本次交出的裁床工厂，请重新选择。')
      const appendInput = buildSpecialCraftBagReturnAppendInput({ request, sourceFact })
      expectedCanonicalIntent = (appendInput.payload as CompleteSpecialCraftBagReturnPayload).canonicalIntent
      const idempotencyCollisions = events.filter((event) =>
        event.idempotencyKey === appendInput.idempotencyKey)
      if (idempotencyCollisions.length > 1) {
        throw new Error('特殊工艺带袋回仓的业务意图冲突。')
      }
      if (idempotencyCollisions.length === 1) return appendInput
      if (listSpecialCraftTicketReturnFacts(events, storage).some(fact => fact.sourceHandoverRecordId === sourceFact.handoverRecordId)) throw new Error('本次已有菲票点收，请更正原实收，不能再新增整袋回仓。')

      const current = resolveTransferBagCurrentUseFromSnapshot(request.bagCode, events)
      if (current.mainStatus === 'DISABLED') {
        throw new Error('这个袋子已经报废，不能执行特殊工艺带袋回仓。')
      }
      if (
        current.mainStatus !== 'IN_USE'
        || current.flowStage !== 'HANDED_OVER_WAITING_RETURN'
        || current.usageCycleId !== sourceFact.usageCycleId
        || current.latestHandoverEventId !== sourceFact.event.eventId
      ) {
        throw new Error('当前中转袋不是该来源记录的已交出待回收状态。')
      }
      const expectedTicketIds = sourceFact.payload.ticketSnapshot.map((ticket) => ticket.feiTicketId)
      if (!sameStrings(expectedTicketIds, request.returnedTicketIds)) {
        throw new Error('实物回仓菲票与原交出快照不一致。')
      }
      const rawSnapshot = records(eventPayload(sourceFact.event).ticketSnapshot)
      const invalidTicket = rawSnapshot.find((ticket) => {
        const voidStatus = text(ticket.voidStatus)
        return !text(ticket.feiTicketId) || voidStatus === '已作废' || voidStatus.includes('作废')
      })
      if (invalidTicket) {
        throw new Error(`来源快照中的菲票 ${text(invalidTicket.feiTicketId) || '未知菲票'} 已作废或缺失。`)
      }
      const currentBagByTicketId = buildCurrentTicketBagIndexFromSnapshot(events)
      for (const ticketId of request.returnedTicketIds) {
        const currentBagCode = currentBagByTicketId.get(ticketId)
        if (currentBagCode && currentBagCode !== request.bagCode) {
          throw new Error(`菲票 ${ticketId} 已被其他当前中转袋绑定。`)
        }
      }
      return appendInput
    },
    (candidate, snapshotEvents) => {
      const fact = parseStrictSpecialCraftBagReturnEvent(candidate)
      if (!fact || fact.canonicalIntent !== expectedCanonicalIntent) {
        throw new Error('特殊工艺带袋回仓候选事实不完整，已在写入前拒绝。')
      }
      const candidates = specialCraftHandoverCandidates(
        snapshotEvents,
        fact.sourceHandoverRecordId,
      )
      const sourceFact = candidates.length === 1
        ? parseStrictSpecialCraftHandoverEvent(candidates[0])
        : null
      if (
        !sourceFact
        || sourceFact.event.eventId !== fact.sourceHandoverEventId
        || createCuttingRuntimeChronologyComparator([...snapshotEvents.filter(event => event.eventId !== candidate.eventId), candidate])(candidate, sourceFact.event) <= 0
      ) {
        throw new Error('特殊工艺带袋回仓时间不能早于来源交出事实。')
      }
    },
    storage,
  )
  const fact = parseStrictSpecialCraftBagReturnEvent(result.event)
  if (!fact || fact.canonicalIntent !== expectedCanonicalIntent) {
    throw new Error('特殊工艺带袋回仓的业务意图冲突。')
  }
  return cloneRuntimeEvent(fact.event)
}

export function submitSpecialCraftTicketOnlyReturn(
  input: SubmitSpecialCraftTicketOnlyReturnInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<'特殊工艺回仓'> {
  const rawPayload = input.payload
  const sourceHandoverRecordId = requiredText(rawPayload.sourceHandoverRecordId, '来源特殊工艺交出记录')
  const operator = normalizedOperator(input.operator, '回仓操作人', '特殊工艺回仓员')
  const source = requiredEventSource(input.source, '回仓来源')
  const occurredAt = normalizeTransferBagOperationTime(input.occurredAt || rawPayload.returnedAt)
  const returnedItems = rawPayload.returnedFeiTicketItems
  if (!returnedItems.length) throw new Error('无袋回仓必须包含回仓菲票。')
  const returnedTicketIds = returnedItems.map((item) => text(item.feiTicketId))
  if (returnedTicketIds.some((ticketId) => !ticketId)) throw new Error('回仓菲票编号不能为空。')
  if (new Set(returnedTicketIds).size !== returnedTicketIds.length) {
    throw new Error('回仓菲票编号不能重复。')
  }
  if (text(rawPayload.transferBagCode)) throw new Error('无袋回仓不得携带中转袋编号。')
  const locationRef = parseCompleteWaitHandoverLocationRef(rawPayload.locationRef)
  if (
    !locationRef
    || text(rawPayload.warehouseArea) !== locationRef.areaName
    || text(rawPayload.locationCode) !== locationRef.locationNo
  ) throw new Error('无袋回仓必须选择与库区、库位一致的完整待交出仓库位。')
  if (text(rawPayload.returnedAt) && normalizeTransferBagOperationTime(rawPayload.returnedAt) !== occurredAt) {
    throw new Error('无袋回仓时间与事件时间不一致。')
  }
  if (text(rawPayload.returnedBy) !== operator.operatorName) {
    throw new Error('无袋回仓操作人与载荷不一致。')
  }

  let expectedCanonicalIntent = ''
  const result = appendCuttingRuntimeEventIdempotentValidated<'特殊工艺回仓'>(
    (snapshotEvents) => {
      const events = [...snapshotEvents]
      const candidates = specialCraftHandoverCandidates(events, sourceHandoverRecordId)
      const sourceFact = candidates.length === 1
        ? parseStrictSpecialCraftHandoverEvent(candidates[0])
        : null
      if (!sourceFact) {
        throw new Error('来源特殊工艺交出记录不存在、未成功或事实不完整。')
      }
      const sourcePayload = sourceFact.payload
      if (sourcePayload.locationRef?.factoryId && sourcePayload.locationRef.factoryId !== locationRef.factoryId) throw new Error('无袋回仓库位不属于来源裁床工厂，请重新选择。')
      if (
        text(rawPayload.sourceHandoverOrderId) !== sourcePayload.handoverOrderId
        || text(input.specialCraftId) !== sourceFact.specialCraftId
        || text(rawPayload.receiverFactoryId) !== sourcePayload.receiverFactoryId
        || text(rawPayload.receiverFactoryName) !== sourcePayload.receiverFactoryName
        || text(rawPayload.craftType) !== sourcePayload.craftType
      ) throw new Error('无袋回仓载荷与来源特殊工艺交出事实不一致。')
      const allIds = sourcePayload.ticketSnapshot.map(ticket => ticket.feiTicketId)
      const idempotencyKey = sameStrings(allIds, returnedTicketIds) ? `${sourceFact.handoverRecordId}:SPECIAL_CRAFT_TICKET_ONLY_RETURNED` : `${sourceFact.handoverRecordId}:${returnedTicketIds.slice().sort().join('|')}:SPECIAL_CRAFT_TICKET_ONLY_RETURNED`
      const retryExists = events.some(event => event.idempotencyKey === idempotencyKey)
      const current = resolveTransferBagCurrentUseFromSnapshot(sourceFact.bagCode, events)
      if (
        current.mainStatus !== 'IN_USE'
        || current.flowStage !== 'HANDED_OVER_WAITING_RETURN'
        || current.usageCycleId !== sourceFact.usageCycleId
        || current.latestHandoverEventId !== sourceFact.event.eventId
      ) { if (!retryExists) throw new Error('来源特殊工艺交出记录已不处于待回仓状态。') }
      const expectedTicketIds = sourcePayload.ticketSnapshot.map((ticket) => ticket.feiTicketId)
      if (returnedTicketIds.some(ticketId => !expectedTicketIds.includes(ticketId))) {
        throw new Error('无袋回仓菲票与来源不可变快照不一致。')
      }
      validateSpecialCraftTicketReceipts(sourcePayload.ticketSnapshot.filter(ticket => returnedTicketIds.includes(ticket.feiTicketId)), returnedItems)
      if (!retryExists && listSpecialCraftTicketReturnFacts(events, storage).some(fact => returnedTicketIds.includes(fact.feiTicketId) && fact.specialCraftId === sourcePayload.feiTicketItems.find(item => item.feiTicketId === fact.feiTicketId)?.specialCraftId)) throw new Error('这张菲票本工艺已经点收，请从原回仓记录更正，不得再次新增。')
      const snapshotById = new Map(sourcePayload.ticketSnapshot.map((ticket) => [ticket.feiTicketId, ticket]))
      const sourceItemById = new Map(sourcePayload.feiTicketItems.map((item) => [item.feiTicketId, item]))
      for (const item of returnedItems) {
        const ticketId = text(item.feiTicketId)
        const snapshot = snapshotById.get(ticketId)
        const sourceItem = sourceItemById.get(ticketId)
        if (
          !snapshot
          || !sourceItem
          || text(item.feiTicketNo) !== snapshot.feiTicketNo
          || text(item.specialCraftId) !== sourceItem.specialCraftId
          || text(item.craftType) !== sourcePayload.craftType
          || text(item.partName) !== snapshot.partName
          || text(item.size) !== snapshot.size
          || item.expectedQty !== snapshot.pieceQty
          || !Number.isSafeInteger(item.returnedQty) || item.returnedQty < 0 || item.returnedQty > snapshot.pieceQty
          || item.unit !== '片'
          || item.returnStatus !== (item.returnedQty === snapshot.pieceQty ? '已回仓' : '回仓差异')
        ) throw new Error(`无袋回仓菲票 ${ticketId || '未知菲票'} 与来源不可变快照不一致。`)
      }
      const rawSnapshot = records(eventPayload(sourceFact.event).ticketSnapshot)
      if (rawSnapshot.some((ticket) => {
        const voidStatus = text(ticket.voidStatus)
        return !text(ticket.feiTicketId) || voidStatus === '已作废' || voidStatus.includes('作废')
      })) throw new Error('来源特殊工艺交出快照包含未知、缺失或已作废菲票。')
      const currentBagByTicketId = buildCurrentTicketBagIndexFromSnapshot(events)
      for (const ticketId of returnedTicketIds) {
        const occupiedBag = currentBagByTicketId.get(ticketId)
        if (occupiedBag && !retryExists) throw new Error(`菲票 ${ticketId} 已被当前中转袋 ${occupiedBag} 绑定。`)
      }

      if (text(input.idempotencyKey) && text(input.idempotencyKey) !== idempotencyKey) {
        throw new Error('无袋回仓幂等键与来源特殊工艺交出记录不一致。')
      }
      const payload: CompleteSpecialCraftTicketOnlyReturnPayload = {
        returnRecordId: requiredText(rawPayload.returnRecordId, '无袋回仓记录'),
        returnRecordNo: requiredText(rawPayload.returnRecordNo, '无袋回仓记录编号'),
        sourceHandoverOrderId: sourcePayload.handoverOrderId,
        sourceHandoverOrderNo: text(rawPayload.sourceHandoverOrderNo) || sourcePayload.handoverOrderId,
        sourceHandoverRecordId: sourceFact.handoverRecordId,
        sourceHandoverRecordNo: text(rawPayload.sourceHandoverRecordNo) || sourceFact.handoverRecordId,
        receiverFactoryId: sourcePayload.receiverFactoryId,
        receiverFactoryName: sourcePayload.receiverFactoryName,
        warehouseName: requiredText(rawPayload.warehouseName, '回仓仓库'),
        craftType: sourcePayload.craftType,
        returnedFeiTicketItems: returnedItems.map((item) => ({
          feiTicketId: text(item.feiTicketId),
          feiTicketNo: text(item.feiTicketNo),
          specialCraftId: sourceItemById.get(text(item.feiTicketId))!.specialCraftId,
          craftType: sourcePayload.craftType,
          partName: text(item.partName),
          size: text(item.size),
          expectedQty: item.expectedQty,
          returnedQty: item.returnedQty,
          differenceReason: text(item.differenceReason),
          processingCompleted: item.processingCompleted,
          unit: '片',
          returnStatus: item.returnedQty === item.expectedQty ? '已回仓' : '回仓差异',
        })),
        warehouseArea: locationRef.areaName,
        locationCode: locationRef.locationNo,
        locationRef: { ...locationRef },
        returnedAt: occurredAt,
        returnedBy: operator.operatorName,
        sourceHandoverEventId: sourceFact.event.eventId,
        ticketSnapshot: sourcePayload.ticketSnapshot.filter(ticket => returnedTicketIds.includes(ticket.feiTicketId)).map((ticket) => ({ ...ticket })),
        idempotencyKey,
        canonicalIntent: '',
        receiptVersion: 1,
      }
      payload.canonicalIntent = buildSpecialCraftTicketOnlyReturnCanonicalIntent({
        payload,
        sourceHandoverEventId: payload.sourceHandoverEventId,
        ticketSnapshot: payload.ticketSnapshot,
        specialCraftId: sourceFact.specialCraftId,
        operator,
        source,
        occurredAt,
        idempotencyKey,
      })
      expectedCanonicalIntent = payload.canonicalIntent
      if (events.filter((event) => event.idempotencyKey === idempotencyKey).length > 1) {
        throw new Error('特殊工艺无袋回仓的业务意图冲突。')
      }
      return {
        idempotencyKey,
        eventType: '特殊工艺回仓',
        eventSource: source,
        eventStatus: '已同步',
        occurredAt,
        operatorId: operator.operatorId,
        operatorName: operator.operatorName,
        operatorRole: operator.operatorRole,
        refs: {
          handoverOrderId: sourcePayload.handoverOrderId,
          handoverRecordId: sourceFact.handoverRecordId,
          specialCraftId: sourceFact.specialCraftId,
          feiTicketIds: payload.ticketSnapshot.map((ticket) => ticket.feiTicketId),
          feiTicketNos: payload.ticketSnapshot.map((ticket) => ticket.feiTicketNo),
        },
        inventoryEffect: {
          inventoryScope: '裁床待交出仓',
          direction: 'IN',
          qty: payload.returnedFeiTicketItems.reduce((sum, ticket) => sum + ticket.returnedQty, 0),
          unit: '片',
          toWarehouseArea: payload.warehouseArea,
          toLocationCode: payload.locationCode,
        },
        payload,
      }
    },
    (candidate, snapshotEvents) => {
      const fact = parseStrictSpecialCraftTicketOnlyReturnEvent(candidate)
      if (!fact || fact.canonicalIntent !== expectedCanonicalIntent) {
        throw new Error('特殊工艺无袋回仓候选事实不完整，已在写入前拒绝。')
      }
      const candidates = specialCraftHandoverCandidates(snapshotEvents, sourceHandoverRecordId)
      const sourceFact = candidates.length === 1
        ? parseStrictSpecialCraftHandoverEvent(candidates[0])
        : null
      if (
        !sourceFact
        || text(fact.payload.sourceHandoverEventId) !== sourceFact.event.eventId
        || createCuttingRuntimeChronologyComparator([...snapshotEvents.filter(event => event.eventId !== candidate.eventId), candidate])(candidate, sourceFact.event) <= 0
      ) throw new Error('特殊工艺无袋回仓时间不能早于来源交出事实。')
    },
    storage,
  )
  const fact = parseStrictSpecialCraftTicketOnlyReturnEvent(result.event)
  if (!fact || fact.canonicalIntent !== expectedCanonicalIntent) {
    throw new Error('特殊工艺无袋回仓的业务意图冲突。')
  }
  return cloneRuntimeEvent(fact.event)
}

/** 无袋回仓只在原独立库存尚未装袋、转移或实交时调整该库存。 */
function canAdjustTicketOnlyReturnInventory(original: CuttingRuntimeEvent, events: readonly CuttingRuntimeEvent[]): boolean {
  let first = original
  const visited = new Set<string>()
  while (text(eventPayload(first).correctionOfEventId)) {
    if (visited.has(first.eventId)) return false
    visited.add(first.eventId)
    const previous = events.find(event => event.eventId === text(eventPayload(first).correctionOfEventId))
    if (!previous || !parseStrictSpecialCraftTicketOnlyReturnEvent(previous)) return false
    first = previous
  }
  const initial = parseStrictSpecialCraftTicketOnlyReturnEvent(first)
  if (!initial) return false
  const ticketIds = new Set(initial.payload.returnedFeiTicketItems.map(item => item.feiTicketId))
  const touchesTicket = (items: Array<{ feiTicketId: string }>) => items.some(item => ticketIds.has(item.feiTicketId))
  const compareChronology = createCuttingRuntimeChronologyComparator(events)
  for (const event of events) {
    if (!isSuccessfulRuntimeEvent(event) || compareChronology(event, first) <= 0) continue
    const payload = eventPayload(event)
    if (event.eventType === '简易裁片交出') {
      if (payload.schemaVersion === 1 && text(payload.assignmentId) && text(payload.handoverRecordId) && payload.receiptStatus === 'RECEIVED' && touchesTicket(records(payload.tickets).map(item => ({ feiTicketId: text(item.feiTicketId) })))) return false
      continue
    }
    if (event.eventType === '新增交出记录' || event.eventType === '特殊工艺交出') {
      const wholeBag = event.eventType === '新增交出记录' ? parseStrictWholeBagHandoverEvent(event) : null
      const specialCraft = event.eventType === '特殊工艺交出' ? parseStrictSpecialCraftHandoverEvent(event) : null
      if ((wholeBag && touchesTicket(records(eventPayload(wholeBag.event).feiTicketItems).map(item => ({ feiTicketId: text(item.feiTicketId) })))) || (specialCraft && touchesTicket(specialCraft.payload.ticketSnapshot))) return false
      continue
    }
    if (event.eventType === '菲票装袋' || event.eventType === '中转袋入仓') {
      if ((text(payload.bagCode) || text(event.refs.transferBagCode)) && eventUsageCycleId(event) && touchesTicket(records(payload.feiTicketItems).map(item => ({ feiTicketId: text(item.feiTicketId) })))) return false
      continue
    }
    if (event.eventType === '中转袋拆袋重装') {
      const repack = parseCompleteTransferBagRepackPayload(event)
      if (repack && repack.sourceBags.some(bag => touchesTicket(bag.beforeTickets))) return false
      continue
    }
    if (event.eventType === '特殊工艺回仓') {
      const returned = parseStrictSpecialCraftBagReturnEvent(event) || parseStrictSpecialCraftTicketOnlyReturnEvent(event)
      if (returned && returned.payload.sourceHandoverEventId !== initial.payload.sourceHandoverEventId && touchesTicket(returned.payload.ticketSnapshot)) return false
    }
  }
  const currentBags = buildCurrentTicketBagIndexFromSnapshot(events)
  return ![...ticketIds].some(ticketId => currentBags.has(ticketId))
}

/** RECEIPT-006: 更正必须引用最新回仓；保留原记录，库存只保存本次差额。 */
export function correctSpecialCraftTicketReturn(input: {
  sourceReturnEventId: string
  ticketReceipts: SpecialCraftTicketReceiptInput[]
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  reason: string
  occurredAt?: string
}, storage: BrowserStorageLike | null = getBrowserLocalStorage()): CuttingRuntimeEvent<'特殊工艺回仓'> {
  const sourceReturnEventId = requiredText(input.sourceReturnEventId, '原回仓记录')
  const reason = requiredText(input.reason, '更正原因')
  const operator = normalizedOperator(input.operator, '更正操作人', '特殊工艺回仓员')
  const priorCorrection = !input.occurredAt ? listManagedCuttingRuntimeEvents(storage).find(event => (event.payload as SpecialCraftReturnPayload).correctionOfEventId === sourceReturnEventId) : null
  const occurredAt = normalizeTransferBagOperationTime(input.occurredAt || priorCorrection?.occurredAt)
  let expectedCanonicalIntent = ''
  const result = appendCuttingRuntimeEventIdempotentValidated<'特殊工艺回仓'>(events => {
    const original = events.find(event => event.eventId === sourceReturnEventId)
    const originalFact = original && (parseStrictSpecialCraftBagReturnEvent(original) || parseStrictSpecialCraftTicketOnlyReturnEvent(original))
    if (!originalFact) throw new Error('原回仓记录不完整，请重新读取后更正。')
    const oldPayload = originalFact.payload
    const receipts = validateSpecialCraftTicketReceipts(oldPayload.ticketSnapshot, input.ticketReceipts, false)
    const receiptById = new Map(receipts.map(receipt => [receipt.feiTicketId, receipt]))
    const version = (oldPayload.receiptVersion || 1) + 1
    const idempotencyKey = `${sourceReturnEventId}:RECEIPT_CORRECTION:${version}`
    const duplicate = events.find(event => event.idempotencyKey === idempotencyKey)
    const effective = listSpecialCraftTicketReturnFacts(events, storage)
    if (!duplicate && oldPayload.returnedFeiTicketItems.some(item => effective.find(fact => fact.feiTicketId === item.feiTicketId && fact.specialCraftId === item.specialCraftId)?.eventId !== sourceReturnEventId)) throw new Error('实收已被其他操作更正，请重新读取后再填写。')
    const bagFact = parseStrictSpecialCraftBagReturnEvent(original!)
    const current = bagFact ? resolveTransferBagCurrentUseFromSnapshot(bagFact.bagCode, [...events]) : null
    const inventoryAdjusted = duplicate ? (duplicate.payload as SpecialCraftReturnPayload).inventoryAdjusted !== false : bagFact
      ? Boolean(current?.usageCycleId === bagFact.usageCycleId && current.latestHandoverEventId === bagFact.sourceHandoverEventId && current.flowStage === 'INBOUND_STORED')
      : canAdjustTicketOnlyReturnInventory(original!, events)
    const payload = { ...oldPayload,
      returnRecordId: `${oldPayload.returnRecordId}:V${version}`,
      returnRecordNo: `${oldPayload.returnRecordNo} · 更正 V${version}`,
      correctionOfEventId: sourceReturnEventId, receiptVersion: version, correctionReason: reason,
      inventoryAdjusted,
      previousReturnedQty: oldPayload.returnedFeiTicketItems.reduce((sum, item) => sum + item.returnedQty, 0),
      returnedAt: occurredAt, returnedBy: operator.operatorName, idempotencyKey,
      returnedFeiTicketItems: oldPayload.returnedFeiTicketItems.map(item => ({ ...item,
        returnedQty: receiptById.get(item.feiTicketId)!.returnedQty,
        differenceReason: receiptById.get(item.feiTicketId)!.differenceReason || reason,
        returnStatus: receiptById.get(item.feiTicketId)!.returnedQty === item.expectedQty ? '已回仓' as const : '回仓差异' as const,
      })), canonicalIntent: '',
    }
    const correctionInput = { source: input.source, operator, occurredAt, idempotencyKey }
    payload.canonicalIntent = bagFact ? buildSpecialCraftBagReturnCanonicalIntent({
      ...correctionInput, sourceHandoverRecordId: payload.sourceHandoverRecordId,
      sourceHandoverEventId: payload.sourceHandoverEventId, sourceHandoverOrderId: payload.sourceHandoverOrderId,
      bagCode: bagFact.bagCode, usageCycleId: bagFact.usageCycleId, handoverLegId: bagFact.handoverLegId,
      specialCraftId: original!.refs.specialCraftId!, receiverFactoryId: payload.receiverFactoryId,
      receiverFactoryName: payload.receiverFactoryName, craftType: payload.craftType || '',
      returnedTicketIds: receipts.map(receipt => receipt.feiTicketId), ticketSnapshot: payload.ticketSnapshot,
      ticketReceipts: payload.returnedFeiTicketItems, correctionOfEventId: sourceReturnEventId,
      receiptVersion: version, previousReturnedQty: payload.previousReturnedQty,
      correctionReason: reason,
      inventoryAdjusted,
      locationRef: payload.locationRef!,
    }) : buildSpecialCraftTicketOnlyReturnCanonicalIntent({ ...correctionInput, payload,
      sourceHandoverEventId: payload.sourceHandoverEventId, ticketSnapshot: payload.ticketSnapshot,
      specialCraftId: original!.refs.specialCraftId!,
    })
    expectedCanonicalIntent = payload.canonicalIntent
    return { ...correctionInput, eventId: idempotencyKey, eventType: '特殊工艺回仓', eventSource: input.source, eventStatus: '已同步',
      operatorId: operator.operatorId, operatorName: operator.operatorName, operatorRole: operator.operatorRole,
      refs: { ...original!.refs }, inventoryEffect: { ...original!.inventoryEffect!, direction: 'ADJUST',
        qty: inventoryAdjusted ? payload.returnedFeiTicketItems.reduce((sum, item) => sum + item.returnedQty, 0) - payload.previousReturnedQty : 0 }, payload,
    }
  }, (candidate, events) => {
    const fact = parseStrictSpecialCraftBagReturnEvent(candidate) || parseStrictSpecialCraftTicketOnlyReturnEvent(candidate)
    if (!fact || (!events.some(event => event.eventId === candidate.eventId) && !listSpecialCraftTicketReturnFacts([...events, candidate], storage).some(item => item.eventId === candidate.eventId))) throw new Error('更正记录的数量、阶段或版本不一致，已拒绝保存。')
  }, storage)
  const saved = parseStrictSpecialCraftBagReturnEvent(result.event) || parseStrictSpecialCraftTicketOnlyReturnEvent(result.event)
  if (!saved || saved.canonicalIntent !== expectedCanonicalIntent) throw new Error('这次更正已保存为其他内容，请重新读取后再操作。')
  return cloneRuntimeEvent(result.event)
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

function buildWholeBagAutomaticSewingReceipts(tickets: TransferBagTicketFactSnapshot[], receivedAt: string, receivedBy: string) {
  const receipts = new Map<string, NonNullable<WholeBagHandoverSubmitPayload['automaticSewingReceipts']>[number]>()
  for (const ticket of tickets) {
    if (isFabricBagTicket(ticket)) continue
    const task = getRuntimeTaskById(ticket.sewingTaskId)
    if (task && (!isRuntimeSewingTask(task) || task.productionOrderId !== ticket.productionOrderId || ['CANCELLED', 'BLOCKED', 'DONE'].includes(task.status))) {
      throw new Error(`车缝任务 ${ticket.sewingTaskId} 当前不能接收本生产单裁片`)
    }
    const receipt = receipts.get(ticket.sewingTaskId) || { sewingTaskId: ticket.sewingTaskId, ...(task ? { runtimeTaskId: task.taskId } : {}), receivedPieceQty: 0, receivedAt, receivedBy, ticketIds: [] }
    receipt.receivedPieceQty += ticket.pieceQty
    receipt.ticketIds.push(ticket.feiTicketId)
    receipts.set(ticket.sewingTaskId, receipt)
  }
  return [...receipts.values()]
}

function startWholeBagReceivedSewingTasks(event: CuttingRuntimeEvent<'新增交出记录'>, storage: BrowserStorageLike | null): void {
  // Task-batch preflight replays into temporary storage; only the actual current ledger may start tasks.
  if (storage !== getBrowserLocalStorage() || isBrowserBusinessStorageStaged()) return
  const payload = event.payload as WholeBagHandoverSubmitPayload
  for (const receipt of payload.automaticSewingReceipts || []) {
    if (!receipt.runtimeTaskId) continue // Explicitly unbound historical prototype task; never invent a runtime task.
    autoStartRuntimeSewingTaskFromCutPieceHandover({ taskId: receipt.runtimeTaskId, handoverRecordNo: payload.handoverRecordNo, receivedAt: receipt.receivedAt, receivedBy: receipt.receivedBy })
  }
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
  const handoverContext = input.handoverContext
    ? normalizeHandoverTaskContext(input.handoverContext)
    : undefined
  const occurredAt = input.occurredAt?.trim()
    || localDateTimeText().slice(0, 16)
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
      const retrySnapshot = normalizeRequiredSubmittedTicketSnapshot(input.submittedTicketSnapshot)
      retryCanonicalIntent = buildWholeBagHandoverCanonicalIntent({
        bagCode,
        usageCycleId,
        handoverLegId: existingFact.handoverLegId,
        handoverOrderId,
        handoverOrderNo,
        handoverRecordId,
        handoverRecordNo,
        assignments: normalizeRequiredAssignments(input.assignments),
        submittedTicketSnapshot: retrySnapshot,
        source: input.source,
        operator: input.operator,
        ...(handoverContext ? { handoverContext: { ...handoverContext, targetFeiTicketIds: retrySnapshot.map((ticket) => ticket.feiTicketId) } } : {}),
      })
    } catch {
      throw new Error(`交出记录 ID ${handoverRecordId} 已存在，但本次请求业务意图冲突。`)
    }
    if (existingFact.canonicalIntent === retryCanonicalIntent) {
      startWholeBagReceivedSewingTasks(existingFact.event, storage)
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
    storage,
    ...(handoverContext ? { handoverContext } : {}),
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
    ...(handoverContext ? { handoverContext: { ...handoverContext, targetFeiTicketIds: submittedTicketSnapshot.map((ticket) => ticket.feiTicketId) } } : {}),
  })
  const sourceLocation = wholeBagHandoverSourceLocation({ currentUse, events })
  const woolTickets = eligibility.ticketSnapshot.filter((item) => item.feiTicketNo.startsWith('WOOL-PANEL:'))
  const woolSources = woolTickets.length ? listWoolPanelCuttingReceiptSources() : []
  for (const ticket of woolTickets) {
    const source = woolSources.find((item) => item.feiTicketNo === ticket.feiTicketNo)
    if (!source || source.receivingFactoryId !== (sourceLocation.locationRef?.factoryId || WOOL_DEFAULT_CUTTING_FACTORY_ID)
      || (sourceLocation.locationRef && source.receivingWarehouseId !== sourceLocation.locationRef.warehouseId) || source.feiTicketId !== ticket.feiTicketId || Boolean(ticket.cutOrderId || ticket.cutOrderNo) || source.productionOrderId !== ticket.productionOrderId || source.partCode !== ticket.partCode || source.skuColor !== ticket.color || source.skuSize !== ticket.size || source.qty !== ticket.pieceQty) throw new Error(`毛织片票 ${ticket.feiTicketNo} 与裁床实收事实不一致`)
  }
  const automaticSewingReceipts = buildWholeBagAutomaticSewingReceipts(eligibility.ticketSnapshot, occurredAt, eligibility.receiverFactoryName)
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
    automaticSewingReceipts,
    handoverLegId: handoverLeg.handoverLegId,
    ...(handoverContext ? {
      handoverBatchId: handoverContext.handoverBatchId,
      receiverPpicId: handoverContext.receiverPpicId,
      receiverPpicName: handoverContext.receiverPpicName,
      targetFeiTicketIds: [...handoverContext.targetFeiTicketIds],
    } : {}),
    handoverOrderId,
    handoverOrderNo,
    handoverRecordId,
    handoverRecordNo,
    receiverType: '车缝厂',
    receiverId: eligibility.receiverFactoryId,
    receiverName: eligibility.receiverFactoryName,
    transferBagUses: [transferBagUse],
    feiTicketItems: ticketSnapshot.map((ticket) => ({
      ...mixedBagTicketFields(ticket as unknown as Record<string, unknown>),
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
      ...(handoverContext ? { handoverBatchId: handoverContext.handoverBatchId } : {}),
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
  startWholeBagReceivedSewingTasks(persistedFact.event, storage)
  return persistedFact.event
}
