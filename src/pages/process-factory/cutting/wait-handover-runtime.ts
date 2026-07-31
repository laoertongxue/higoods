import {
  appendCuttingRuntimeEvent,
  listCuttingRuntimeEvents,
  listCuttingRuntimeEventsByInventoryScope,
  listCuttingRuntimeEventsByType,
  type CuttingRuntimeEvent,
  type CuttingRuntimeEventSource,
  type FeiTicketBaggingPayload,
  type FeiTicketInboundPayload,
  type RuntimeWarehouseLocationRef,
  type TransferBagInboundPayload,
  type HandoverRecordSubmitPayload,
  type HandoverBaggingConfirmPayload,
  type SpecialCraftHandoverPayload,
  type SpecialCraftReturnPayload,
} from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
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
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim() || '').filter(Boolean)))
}

function compactDate(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 14) || String(Date.now())
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

export function listWaitHandoverRuntimeEvents(): CuttingRuntimeEvent[] {
  const events = [
    ...listCuttingRuntimeEventsByInventoryScope('裁床待交出仓'),
    ...listCuttingRuntimeEventsByType('菲票装袋'),
    ...listCuttingRuntimeEventsByType('中转袋入仓'),
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
      states.set(bagCode, {
        sourceEventId: event.eventId,
        bagCode,
        productionOrderNo: event.refs.productionOrderNo || '',
        feiTicketIds: [...(event.refs.feiTicketIds ?? [])],
        totalPieceQty: runtimeNumber(payload.totalPieceQty) || Number(event.inventoryEffect?.qty || 0),
        inboundAt: runtimeString(payload.inboundAt) || event.occurredAt,
        inboundBy: runtimeString(payload.inboundBy) || event.operatorName,
        locationRef,
      })
      continue
    }
    if (event.eventType === '交出装袋确认') {
      const sourceBagCode = runtimeString(payload.sourceTempBagCode)
      const targetBagCode = runtimeString(payload.targetTransferBagCode) || event.refs.transferBagCode || ''
      const source = sourceBagCode ? states.get(sourceBagCode) : undefined
      if (!source || !targetBagCode) continue
      states.delete(sourceBagCode)
      states.set(targetBagCode, {
        ...source,
        sourceEventId: event.eventId,
        bagCode: targetBagCode,
        feiTicketIds: event.refs.feiTicketIds?.length ? [...event.refs.feiTicketIds] : source.feiTicketIds,
        totalPieceQty: Number(event.inventoryEffect?.qty || source.totalPieceQty),
      })
      continue
    }
    if (event.eventType === '新增交出记录') {
      const bagCode = event.refs.transferBagCode || runtimeString(payload.transferBagCode)
      if (bagCode) states.delete(bagCode)
      continue
    }
    if (event.eventType === '特殊工艺交出') {
      const bagCode = event.refs.transferBagCode || runtimeString(payload.transferBagCode)
      const current = bagCode ? states.get(bagCode) : undefined
      if (!bagCode || !current) continue
      const handedOverQty = Number(event.inventoryEffect?.qty || runtimeNumber(payload.handoverQty))
      const remainingQty = Math.max(0, current.totalPieceQty - handedOverQty)
      if (remainingQty <= 0) {
        states.delete(bagCode)
      } else {
        states.set(bagCode, {
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
      const current = states.get(bagCode)
      const returnedQty = Number(event.inventoryEffect?.qty || 0)
      states.set(bagCode, {
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
        objectNo: runtimeString(payload.transferBagCode) || runtimeString(payload.returnRecordNo) || returnRecordId,
        objectName: runtimeString(payload.transferBagCode)
          ? `中转袋 ${runtimeString(payload.transferBagCode)}`
          : `特殊工艺回仓 ${runtimeString(payload.returnRecordNo) || returnRecordId}`,
      })
    }
  }
  return Array.from(states.values())
}

export function buildWaitHandoverRuntimeProjection(generatedTickets = listSpreadingResultGeneratedFeiTickets()): WaitHandoverRuntimeProjection {
  const runtimeEvents = listWaitHandoverRuntimeEvents()
  const inboundTempBags = buildRuntimeInboundTempBagsFromWaitHandoverEvents(runtimeEvents, generatedTickets)
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
  const inboundTicketIds = new Set(inboundInventoryRecords.map((record) => record.feiTicketId))
  return {
    runtimeEvents,
    generatedTickets,
    inboundTempBags,
    inboundInventoryRecords,
    ticketCandidates: generatedTickets.filter((ticket) => !inboundTicketIds.has(ticket.feiTicketId)),
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
}) {
  const ticketIds = input.tickets.map((ticket) => ticket.feiTicketId).filter(Boolean).sort()
  const existing = listCuttingRuntimeEventsByType('菲票装袋').find((event) =>
    event.refs.transferBagCode === input.bagCode
    && [...(event.refs.feiTicketIds || [])].sort().join('|') === ticketIds.join('|'))
  if (existing) return existing
  const occurredAt = input.occurredAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
  const tickets = input.tickets
  const totalPieceQty = tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
  const first = tickets[0]
  const payload: FeiTicketBaggingPayload = {
    baggingRecordId: `bagging:${input.bagCode}:${compactDate(occurredAt)}`,
    bagCode: input.bagCode,
    feiTicketItems: tickets.map((ticket) => ({
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      spreadingOrderId: ticket.spreadingOrderId,
      spreadingOrderNo: ticket.spreadingOrderNo,
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      pieceQty: ticket.pieceQty,
      unit: '片',
      pieceSequenceLabel: ticket.pieceSequenceLabel,
      hasSpecialCraft: ticket.hasSpecialCraft,
      specialCraftCategory: ticket.hasSpecialCraft ? ticket.specialCraftDisplay : '无',
    })),
    totalPieceQty,
    mixedFlag: buildMixedFlag(tickets),
    baggingBy: input.operator.operatorName,
    baggingAt: occurredAt,
  }
  return appendCuttingRuntimeEvent({
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
    },
    payload,
  })
}

export function appendWaitHandoverInboundEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  warehouseArea: string
  locationCode: string
  locationRef?: RuntimeWarehouseLocationRef
  idempotencyKey?: string
  tickets: WaitHandoverRuntimeTicketInput[]
  occurredAt?: string
}) {
  if (input.idempotencyKey) {
    const existing = listCuttingRuntimeEventsByType('中转袋入仓').find((event) =>
      runtimeString(runtimeRecord(event.payload).idempotencyKey) === input.idempotencyKey
    )
    if (existing) return existing
  }
  const occurredAt = input.occurredAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
  const tickets = input.tickets
  const totalPieceQty = tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
  const first = tickets[0]
  const payload: FeiTicketInboundPayload = {
    tempBagUseId: `temp-bag:${input.bagCode}:${compactDate(occurredAt)}`,
    bagCode: input.bagCode,
    warehouseArea: input.warehouseArea,
    locationCode: input.locationCode,
    inboundBy: input.operator.operatorName,
    inboundAt: occurredAt,
    feiTicketItems: tickets.map((ticket) => ({
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      spreadingOrderId: ticket.spreadingOrderId,
      spreadingOrderNo: ticket.spreadingOrderNo,
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      pieceQty: ticket.pieceQty,
      unit: '片',
      pieceSequenceLabel: ticket.pieceSequenceLabel,
      hasSpecialCraft: ticket.hasSpecialCraft,
    })),
    totalPieceQty,
    mixedFlag: buildMixedFlag(tickets),
    locationRef: input.locationRef,
    idempotencyKey: input.idempotencyKey,
  }
  return appendCuttingRuntimeEvent({
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
  })
}

export function appendWaitHandoverBaggingConfirmEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  pickingTaskId: string
  pickingTaskNo: string
  sewingTaskId: string
  sewingTaskNo: string
  sourceTempBagCode: string
  targetTransferBagCode: string
  bagUseId?: string
  tickets: Array<Pick<WaitHandoverRuntimeTicketInput, 'feiTicketId' | 'feiTicketNo' | 'pieceQty'>>
  occurredAt?: string
}) {
  const existing = listCuttingRuntimeEventsByType('交出装袋确认').find((event) =>
    runtimeString(runtimeRecord(event.payload).pickingTaskId) === input.pickingTaskId)
  if (existing) return existing
  const occurredAt = input.occurredAt || new Date().toISOString()
  const recordId = `${input.source}-BAG-CONFIRM-${input.pickingTaskId}-${Date.now()}`
  const totalPieceQty = input.tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty || 0), 0)
  const ticketIds = input.tickets.map((ticket) => ticket.feiTicketId).filter(Boolean)
  const ticketNos = input.tickets.map((ticket) => ticket.feiTicketNo).filter(Boolean)
  const payload: HandoverBaggingConfirmPayload = {
    baggingConfirmRecordId: recordId,
    baggingConfirmRecordNo: `SBG-${compactDate(occurredAt)}-${input.pickingTaskNo}`,
    pickingTaskId: input.pickingTaskId,
    pickingTaskNo: input.pickingTaskNo,
    sewingTaskId: input.sewingTaskId,
    sewingTaskNo: input.sewingTaskNo,
    sourceTempBagCode: input.sourceTempBagCode,
    targetTransferBagCode: input.targetTransferBagCode,
    bagUseId: input.bagUseId || `${input.source}-BAG-USE-${input.pickingTaskId}-${Date.now()}`,
    scannedFeiTicketIds: ticketIds,
    scannedFeiTicketNos: ticketNos,
    containedFeiTicketIds: ticketIds,
    containedFeiTicketNos: ticketNos,
    totalPieceQty,
    pickedQty: totalPieceQty,
    unit: '片',
    scannedAt: occurredAt,
    scannedBy: input.operator.operatorName,
    packedAt: occurredAt,
    packedBy: input.operator.operatorName,
    checkResult: '正常',
    bagBindingRule: '一个中转袋只能绑定一个车缝任务',
  }
  return appendCuttingRuntimeEvent({
    eventType: '交出装袋确认',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '裁片仓装袋确认员',
    refs: {
      feiTicketIds: payload.containedFeiTicketIds,
      feiTicketNos: payload.containedFeiTicketNos,
      transferBagCode: input.targetTransferBagCode,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'ADJUST',
      qty: totalPieceQty,
      unit: '片',
      fromWarehouseArea: '入仓暂存区',
      toWarehouseArea: '中转袋暂存区',
    },
    payload,
  })
}

export function appendWaitHandoverHandoverRecordEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  payload: HandoverRecordSubmitPayload
  fromWarehouseArea: string
  fromLocationCode: string
  occurredAt?: string
}) {
  const existing = listCuttingRuntimeEventsByType('新增交出记录').find((event) =>
    event.refs.handoverRecordId === input.payload.handoverRecordId)
  if (existing) return existing
  const occurredAt = input.occurredAt || input.payload.submittedAt || new Date().toISOString()
  const feiTicketIds = input.payload.feiTicketItems.map((item) => item.feiTicketId).filter(Boolean)
  const feiTicketNos = input.payload.feiTicketItems.map((item) => item.feiTicketNo).filter(Boolean)
  return appendCuttingRuntimeEvent({
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
      transferBagCode: input.payload.transferBagUses[0]?.bagCode || '',
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'OUT',
      qty: input.payload.currentHandedOverQty,
      unit: '片',
      fromWarehouseArea: input.fromWarehouseArea,
      fromLocationCode: input.fromLocationCode,
    },
    payload: input.payload,
  })
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
  occurredAt?: string
}) {
  const idempotencyKey = [
    'special-craft-handover',
    input.handoverRecordId,
    input.specialCraftId,
    ...input.payload.feiTicketItems.map((item) => item.feiTicketId),
  ].join(':')
  const existing = listCuttingRuntimeEventsByType('特殊工艺交出').find((event) =>
    runtimeString(runtimeRecord(event.payload).idempotencyKey) === idempotencyKey)
  if (existing) return existing
  const occurredAt = input.occurredAt || input.payload.handedOverAt || new Date().toISOString()
  const totalQty = input.payload.feiTicketItems.reduce((sum, item) => sum + Number(item.pieceQty || 0), 0)
  const currentLocation = buildWaitHandoverLocationOccupancyStates(listWaitHandoverRuntimeEvents())
    .find((state) => state.bagCode === input.transferBagCode)
  const payload: SpecialCraftHandoverPayload = {
    ...input.payload,
    locationRef: currentLocation?.locationRef,
    idempotencyKey,
  }
  return appendCuttingRuntimeEvent({
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
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'OUT',
      qty: totalQty,
      unit: '片',
      fromWarehouseArea: currentLocation?.locationRef.areaName || input.fromWarehouseArea,
      fromLocationCode: currentLocation?.locationRef.locationNo,
    },
    payload,
  })
}

export function appendWaitHandoverSpecialCraftReturnEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  payload: SpecialCraftReturnPayload
  specialCraftId: string
  occurredAt?: string
}) {
  const idempotencyKey = input.payload.idempotencyKey || [
    'special-craft-return',
    input.payload.sourceHandoverRecordId,
    input.specialCraftId,
    ...input.payload.returnedFeiTicketItems.map((item) => item.feiTicketId),
  ].join(':')
  const existing = listCuttingRuntimeEventsByType('特殊工艺回仓').find((event) =>
    runtimeString(runtimeRecord(event.payload).idempotencyKey) === idempotencyKey
  )
  if (existing) return existing
  const occurredAt = input.occurredAt || input.payload.returnedAt || new Date().toISOString()
  const returnedQty = input.payload.returnedFeiTicketItems.reduce((sum, item) => sum + Number(item.returnedQty || 0), 0)
  const payload = { ...input.payload, idempotencyKey }
  return appendCuttingRuntimeEvent({
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
      transferBagCode: input.payload.transferBagCode,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'IN',
      qty: returnedQty,
      unit: '片',
      toWarehouseArea: input.payload.warehouseArea,
      toLocationCode: input.payload.locationCode,
    },
    payload,
  })
}
