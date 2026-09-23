import type { DyeWorkOrder, DyeExecutionNodeRecord, DyeDispatchDocument } from './dyeing-task-domain.ts'
import type { PdaHandoverRecord } from './pda-handover-events.ts'
import type { FactoryReceivingSource, FactoryDeliveryNote, FactoryReceipt } from './factory-receiving-types.ts'

export const DYE_TIME_LABELS = {
  demandCreatedAt: '生产需求单创建', productionCreatedAt: '生产单生成', orderedAt: '染色加工单创建',
  pendingReceiptAt: '待接收单生成', upstreamSentAt: '上游发出', receivedAt: '本厂实际接收',
  plannedFinishAt: '计划完成', dyeStartedAt: '染色开始', dyeFinishedAt: '染色完成', completedAt: '加工完成',
  dispatchCreatedAt: '交出单创建', deliveredAt: '实际交出', downstreamReceivedAt: '下游实际接收',
} as const
export type DyeTimeKey = keyof typeof DYE_TIME_LABELS
export interface DyeTimeEvent { id: string; at: string; reference: string }
export interface DyeTimeItem { key: string; label: string; events: DyeTimeEvent[]; emptyLabel: string }
export interface DyeTimeSection { key: string; label: string; items: DyeTimeItem[] }
export interface DyeTimeContext {
  sources: FactoryReceivingSource[]
  deliveries: FactoryDeliveryNote[]
  receipts: FactoryReceipt[]
  dispatches: DyeDispatchDocument[]
  warehouseFacts?: Array<{ documentNo: string; approvedAt?: string; sentAt?: string }>
  upstreamHandovers?: PdaHandoverRecord[]
}

export function latestDyeEventTime(times: Array<string | undefined>): string {
  return times.filter((at): at is string => Boolean(at)).sort().at(-1) || ''
}

export function formatDyeTimeItem(item: DyeTimeItem): string {
  if (!item.events.length) return item.emptyLabel
  const times = item.events.map(event => event.at).filter(Boolean).sort()
  if (!times.length) return `历史时间未记录${item.events.length > 1 ? `（${item.events.length} 笔）` : ''}`
  if (item.events.length === 1) return times[0]
  const missing = item.events.length - times.length
  return `${missing ? '首次已记录' : '首次'} ${times[0]}；${missing ? '最近已记录' : '最近'} ${times.at(-1)}；共 ${item.events.length} 笔${missing ? `（${missing} 笔历史时间未记录）` : ''}`
}

/** Only projects existing dyeing facts; it neither stores events nor infers dates from updatedAt. */
export function buildDyeWorkOrderTimes(input: {
  order: DyeWorkOrder
  production?: { number: string; createdAt: string; demands: Array<{ id: string; createdAt: string }> }
  nodes: DyeExecutionNodeRecord[]
  handovers: PdaHandoverRecord[]
  plannedFinishAt: string
  upstreamDocumentNos: string[]
  upstreamRecordIds?: string[]
  materialSku: string
  sentQty: number
  receivedQty: number
  completedQty: number
  handedOverQty: number
  downstreamReceivedQty: number
  context: DyeTimeContext
}): DyeTimeSection[] {
  const { order, production, nodes, plannedFinishAt, context } = input
  const event = (id: string, at: string | undefined, reference = id): DyeTimeEvent => ({ id, at: at || '', reference })
  const item = (key: string, label: string, events: DyeTimeEvent[], emptyLabel: string): DyeTimeItem => ({
    key, label, events: [...new Map(events.map(value => [value.id, value])).values()].sort((a, b) => a.at.localeCompare(b.at)), emptyLabel,
  })
  const point = (key: DyeTimeKey, events: DyeTimeEvent[], emptyLabel: string) => item(key, DYE_TIME_LABELS[key], events, emptyLabel)
  const materialReceipts = order.materialReceipts ?? []
  // Include stock receipts allocated after arrival, using their original source and receipt time.
  const upstream = context.sources.filter(source => !source.voidedAt && source.targetFactoryId === order.dyeFactoryId
    && (source.type === 'HANDOUT' ? Boolean(source.handedOutAt) : Boolean(source.approvedAt))
    && (source.lines.some(line => line.dyeOrderId === order.dyeOrderId)
      || materialReceipts.some(receipt => receipt.upstreamRecordId === source.id)
      || input.upstreamDocumentNos.includes(source.documentNo)))
  const upstreamLineIds = new Set(upstream.flatMap(source => source.lines.filter(line => line.dyeOrderId === order.dyeOrderId
    || context.receipts.some(receipt => receipt.lines.some(actual => actual.sourceId === source.id && actual.sourceLineId === line.id
      && materialReceipts.some(projected => projected.receiptId === `FRP-${actual.id}-${order.dyeOrderId}`)))
    || (!line.dyeOrderId && line.material.sku === input.materialSku)).map(line => `${source.id}|${line.id}`)))
  const deliveries = context.deliveries.filter(delivery => delivery.lines.some(line => upstreamLineIds.has(`${line.sourceId}|${line.sourceLineId}`)))
  const upstreamSent = [
    ...deliveries.map(delivery => event(delivery.id, delivery.deliveredAt)),
    // A delivery note is the physical shipment grouping; do not count its source again.
    ...upstream.filter(source => source.handedOutAt && !deliveries.some(delivery => delivery.lines.some(line => line.sourceId === source.id)))
      .map(source => event(source.id, source.handedOutAt, source.documentNo)),
  ]
  const warehouseFacts = (context.warehouseFacts ?? []).filter(fact => input.upstreamDocumentNos.includes(fact.documentNo)
    && !upstream.some(source => source.documentNo === fact.documentNo))
  const legacyHandovers = (context.upstreamHandovers ?? []).filter(record => record.handoverRecordStatus !== 'VOIDED'
    && input.upstreamRecordIds?.some(id => id === record.recordId || id === record.handoverRecordId)
    && !upstream.some(source => Boolean(source.originalRecordId) && (source.originalRecordId === record.recordId || source.originalRecordId === record.handoverRecordId)))
  upstreamSent.push(...warehouseFacts.filter(fact => fact.sentAt).map(fact => event(fact.documentNo, fact.sentAt)),
    ...legacyHandovers.map(record => event(record.recordId, record.factorySubmittedAt, record.handoverRecordNo || record.recordId)))
  const receiptEvents = (positive: boolean) => materialReceipts.filter(receipt => positive ? receipt.qty > 0 : receipt.qty === 0).map(receipt => {
    const original = context.receipts.find(actual => actual.lines.some(line => `FRP-${line.id}-${order.dyeOrderId}` === receipt.receiptId))
    return event(original?.id || receipt.receiptId, receipt.receivedAt, original?.id || receipt.receiptId)
  })
  const received = receiptEvents(true)
  const zeroReceived = receiptEvents(false).filter(receipt => !received.some(actual => actual.id === receipt.id))
  const matchesHandover = (id: string | undefined, record: PdaHandoverRecord) => Boolean(id) && (id === record.recordId || id === record.handoverRecordId)
  const validHandovers = input.handovers.filter(record => record.handoverRecordStatus !== 'VOIDED'
    && !context.dispatches.some(doc => doc.status === '已作废' && doc.lines.some(line => line.orderId === order.dyeOrderId && matchesHandover(line.handoverRecordId, record))))
  const docs = context.dispatches.filter(doc => doc.status !== '已作废' && doc.lines.some(line => line.orderId === order.dyeOrderId))
  const downstreamSources = context.sources.filter(source => !source.voidedAt && source.type === 'HANDOUT' && source.workOrderNo === order.dyeOrderNo
    && !context.dispatches.some(doc => doc.id === source.documentNo && doc.status === '已作废')
    && !input.handovers.some(record => record.handoverRecordStatus === 'VOIDED' && Boolean(source.originalRecordId)
      && (record.recordId === source.originalRecordId || record.handoverRecordId === source.originalRecordId)))
  const downstreamIds = new Set(downstreamSources.map(source => source.id))
  const downstreamReceipts = context.receipts.filter(receipt => receipt.lines.some(line => downstreamIds.has(line.sourceId)))
  const downstreamActual = downstreamReceipts.filter(receipt => receipt.lines.some(line => downstreamIds.has(line.sourceId) && line.qty > 0))
    .map(receipt => event(receipt.id, receipt.receivedAt))
  const downstreamZero = downstreamReceipts.filter(receipt => receipt.lines.filter(line => downstreamIds.has(line.sourceId)).every(line => line.qty === 0))
    .map(receipt => event(receipt.id, receipt.receivedAt))
  for (const record of validHandovers) {
    const matchedSources = downstreamSources.filter(source => matchesHandover(source.originalRecordId, record))
    const hasActualReceipts = downstreamReceipts.some(receipt => receipt.lines.some(line => matchedSources.some(source => source.id === line.sourceId)))
    if (hasActualReceipts) continue // Do not count the same warehouse receipt's PDA writeback twice.
    if (record.taskReceipts?.length) {
      for (const receipt of record.taskReceipts) (receipt.qty > 0 ? downstreamActual : downstreamZero).push(event(receipt.receiptId, receipt.receivedAt))
    } else {
      const qty = record.receiverWrittenQty ?? record.warehouseWrittenQty
      if (qty !== undefined && (qty > 0 || record.receiverWrittenAt || record.warehouseWrittenAt)) (qty > 0 ? downstreamActual : downstreamZero).push(event(record.recordId, record.receiverWrittenAt || record.warehouseWrittenAt, record.handoverRecordNo || record.recordId))
    }
  }
  const dyeNodes = nodes.filter(node => node.nodeCode === 'DYE')
  const packNodes = nodes.filter(node => node.nodeCode === 'PACK')
  // Canonical execution reuses an order/node ID in each batch; occurrence, not ID, identifies a batch.
  const nodeEvents = (records: DyeExecutionNodeRecord[], key: 'startedAt' | 'finishedAt') => records.flatMap((node, index) => {
    const archivedCount = (order.completedExecutionBatches ?? []).filter(batch => batch.some(archived => archived.nodeCode === node.nodeCode)).length
    const occurred = Boolean(node[key]) || index < archivedCount || (key === 'startedAt' && Boolean(node.finishedAt))
    return occurred ? [event(`${node.nodeRecordId}:batch:${index + 1}`, node[key], `第 ${index + 1} 批 · ${node.nodeName} · ${node.nodeRecordId}`)] : []
  })
  const noProduction = order.sourceType === 'STOCK' ? '不适用（备货创建）' : '关联单据时间未记录'
  const creationItems = order.sourceType === 'DESIGN_REVISION'
    ? [point('orderedAt', [event(order.dyeOrderNo, order.createdAt)], '历史时间未记录')]
    : [
      point('demandCreatedAt', (production?.demands ?? []).map(demand => event(demand.id, demand.createdAt)), noProduction),
      point('productionCreatedAt', production ? [event(production.number, production.createdAt)] : [], noProduction),
      point('orderedAt', [event(order.dyeOrderNo, order.createdAt)], '历史时间未记录'),
    ]
  return [
    { key: 'creation', label: '单据创建', items: creationItems },
    { key: 'receipt', label: '上游接收', items: [
      point('pendingReceiptAt', [
        ...upstream.map(source => event(source.id, source.type === 'HANDOUT' ? source.handedOutAt : source.approvedAt, source.documentNo)),
        ...warehouseFacts.filter(fact => fact.approvedAt).map(fact => event(fact.documentNo, fact.approvedAt)),
        ...legacyHandovers.map(record => event(record.recordId, record.factorySubmittedAt, record.handoverRecordNo || record.recordId)),
      ], input.sentQty > 0 || input.receivedQty > 0 ? '历史时间未记录' : '尚未生成待接收单'),
      point('upstreamSentAt', upstreamSent, input.sentQty > 0 || input.receivedQty > 0 ? '历史时间未记录' : '尚未发出'),
      point('receivedAt', received, input.receivedQty > 0 ? '历史时间未记录' : '尚未实际接收'),
      ...(zeroReceived.length ? [item('zeroReceiptAt', '零收货登记', zeroReceived, '')] : []),
    ] },
    { key: 'production', label: '加工生产', items: [
      point('plannedFinishAt', plannedFinishAt ? [event(order.dyeOrderNo, plannedFinishAt)] : [], '尚未安排交期'),
      point('dyeStartedAt', nodeEvents(dyeNodes, 'startedAt'), dyeNodes.some(node => node.finishedAt || (node.inputQty ?? 0) > 0) || input.completedQty > 0 ? '历史时间未记录' : '尚未开始染色'),
      point('dyeFinishedAt', nodeEvents(dyeNodes, 'finishedAt'), input.completedQty > 0 ? '历史时间未记录' : '尚未完成染色'),
      point('completedAt', nodeEvents(packNodes, 'finishedAt'), input.completedQty > 0 ? '历史时间未记录' : order.status === 'REJECTED' ? '已取消，无完成时间' : '尚未完成加工'),
    ] },
    { key: 'handover', label: '下游交出', items: [
      point('dispatchCreatedAt', [
        ...docs.map(doc => event(doc.id, doc.createdAt)),
        ...downstreamSources.filter(source => !docs.some(doc => doc.id === source.documentNo)).map(source => event(source.id, source.createdAt, source.documentNo)),
        ...validHandovers.filter(record => !docs.some(doc => doc.lines.some(line => line.orderId === order.dyeOrderId && matchesHandover(line.handoverRecordId, record)))
          && !downstreamSources.some(source => matchesHandover(source.originalRecordId, record)))
          .map(record => event(record.recordId, '', record.handoverRecordNo || record.recordId)),
      ], validHandovers.length || input.handedOverQty > 0 ? '历史时间未记录' : '尚未创建交出单'),
      point('deliveredAt', [
        ...docs.filter(doc => doc.status === '已交出').map(doc => event(doc.id, doc.handedOverAt)),
        ...validHandovers.filter(record => !context.dispatches.some(doc => doc.lines.some(line => line.orderId === order.dyeOrderId && Boolean(line.handoverRecordId)
          && (line.handoverRecordId === record.recordId || line.handoverRecordId === record.handoverRecordId))))
          .map(record => event(record.recordId, record.factorySubmittedAt, record.handoverRecordNo || record.recordId)),
      ], input.handedOverQty > 0 ? '历史时间未记录' : '尚未交出'),
      point('downstreamReceivedAt', downstreamActual, input.downstreamReceivedQty > 0 ? '历史时间未记录' : '下游尚未实际接收'),
      ...(downstreamZero.length ? [item('downstreamZeroReceiptAt', '下游零收货登记', downstreamZero, '')] : []),
    ] },
  ]
}
