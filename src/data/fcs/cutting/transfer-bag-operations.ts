import {
  appendCuttingRuntimeEventIdempotent,
  listCuttingRuntimeEvents,
  type CuttingRuntimeEvent,
  type CuttingRuntimeEventSource,
  type TransferBagRepackPayload,
  type TransferBagTicketFactSnapshot,
} from './cutting-runtime-event-ledger.ts'
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

function eventPayload(event: CuttingRuntimeEvent): Record<string, unknown> {
  return record(event.payload)
}

function sortedRuntimeEvents(storage: BrowserStorageLike | null): CuttingRuntimeEvent[] {
  return listCuttingRuntimeEvents(storage)
    .filter((event) => event.eventStatus !== '已取消')
    .sort(compareCuttingRuntimeChronologyAscending)
}

function repackBagCodes(event: CuttingRuntimeEvent): string[] {
  if (event.eventType !== '中转袋拆袋重装') return []
  const payload = eventPayload(event)
  return unique([
    ...records(payload.sourceBags).map((bag) => text(bag.bagCode)),
    ...records(payload.resultBags).map((bag) => text(bag.bagCode)),
  ])
}

export function eventTouchesTransferBag(
  event: CuttingRuntimeEvent,
  bagCode: string,
): boolean {
  const normalizedBagCode = bagCode.trim()
  if (!normalizedBagCode || event.eventStatus === '已取消') return false
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
): Record<string, unknown> | undefined {
  return records(eventPayload(event)[kind]).find((bag) => text(bag.bagCode) === bagCode)
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
    const feiTicketIds = result.feiTicketIds.map((feiTicketId) => feiTicketId.trim())
    if (feiTicketIds.some((feiTicketId) => !feiTicketId)) {
      throw new Error(`${bagCode || '结果袋'} 的菲票编号不能为空。`)
    }
    return { bagCode, feiTicketIds }
  })
  assertUniqueNonEmpty(results.map((result) => result.bagCode), '结果袋编号')
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
    sourceBagCodes: unique(input.sourceBagCodes).sort(),
    results: input.results
      .map((result) => ({
        bagCode: result.bagCode.trim(),
        feiTicketIds: unique(result.feiTicketIds).sort(),
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
