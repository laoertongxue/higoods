import type { CuttingRuntimeEvent, TransferBagTicketFactSnapshot, CuttingRuntimeEventSource } from './cutting-runtime-event-ledger.ts'
import { mixedBagTicketFields, bagTicketFieldMissing, MIXED_BAG_EXTRA_FIELDS } from './mixed-transfer-bag-ticket.ts'
import type { FeiTicketSewingAssignment } from './sewing-dispatch.ts'

// 完整交出纯契约；操作模块和PPIC读取同一验证，不依赖交接写入。
export interface TransferBagRuntimeOperator {
  operatorId?: string
  operatorName: string
  operatorRole?: string
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

export function normalizeHandoverTaskContext(context: TransferBagHandoverTaskContext): TransferBagHandoverTaskContext {
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

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

export function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export function sameStrings(left: string[], right: string[]): boolean {
  const a = [...left].sort()
  const b = [...right].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export const WHOLE_BAG_SNAPSHOT_FIELDS: Array<keyof TransferBagTicketFactSnapshot> = [
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

export function normalizeWholeBagTicketSnapshot(
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

export function normalizeRequiredSubmittedTicketSnapshot(
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

export function eventPayload(event: CuttingRuntimeEvent): Record<string, unknown> {
  return record(event.payload)
}

export function ticketSnapshot(
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

export function buildWholeBagHandoverCanonicalIntent(input: {
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

export interface StrictWholeBagHandoverEventFact {
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

export function parseHandoverLegSequence(
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

export function strictRequiredStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.length) return null
  const values = value.map(text)
  if (values.some((item) => !item) || new Set(values).size !== values.length) return null
  return values
}

export function parseStrictWholeBagHandoverEvent(
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
