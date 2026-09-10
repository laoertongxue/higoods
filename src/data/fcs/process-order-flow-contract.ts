/**
 * 全阶段加工单只共享来源引用、唯一接收方快照和三个状态维度的计算。
 * 专项加工单仍保存自己的工艺、数量事件和操作日志。
 */

export type ProcessOrderInputSourceType = 'CENTRAL_TRANSFER' | 'UPSTREAM_HANDOUT'

export type ProcessOrderReceiptStatus =
  | 'WAIT_SOURCE'
  | 'WAIT_RECEIVE'
  | 'PARTIAL_RECEIVED'
  | 'RECEIVED'
  | 'RECEIPT_DIFFERENCE'

export type ProcessOrderProcessingStatus = 'NOT_STARTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'

export type ProcessOrderHandoverStatus = 'NOT_READY' | 'WAIT_HANDOVER' | 'PARTIAL_HANDOVER' | 'FULL_HANDOVER'

export type ProcessOrderReceivingTargetType =
  | 'DOWNSTREAM_PROCESS_ORDER'
  | 'CUTTING_TRANSFER_WAREHOUSE'
  | 'CENTRAL_WAREHOUSE'
  | 'SUPPLEMENT_CONSUMER'

export const PROCESS_ORDER_RECEIPT_STATUS_LABEL: Record<ProcessOrderReceiptStatus, string> = {
  WAIT_SOURCE: '待来源',
  WAIT_RECEIVE: '待接收',
  PARTIAL_RECEIVED: '部分接收',
  RECEIVED: '已收齐',
  RECEIPT_DIFFERENCE: '差异待处理',
}

export const PROCESS_ORDER_PROCESSING_STATUS_LABEL: Record<ProcessOrderProcessingStatus, string> = {
  NOT_STARTED: '未开始',
  PROCESSING: '加工中',
  COMPLETED: '加工完成',
  CANCELLED: '已取消',
}

export const PROCESS_ORDER_HANDOVER_STATUS_LABEL: Record<ProcessOrderHandoverStatus, string> = {
  NOT_READY: '未到交出',
  WAIT_HANDOVER: '待交出',
  PARTIAL_HANDOVER: '部分交出',
  FULL_HANDOVER: '全部交出',
}

export interface ProcessOrderInputSourceReference {
  sourceType: ProcessOrderInputSourceType
  sourceDocumentId: string
  sourceDocumentNo: string
  sourceLineId: string
  sourceWarehouseId?: string
  sourceWarehouseName?: string
  targetWarehouseId: string
  targetWarehouseName: string
  predecessorOrderId?: string
  predecessorOccurrenceId?: string
  routeObjectKey?: string
  qtyUnit: string
  availableQty: number
}

export interface ProcessOrderReceivingTargetSnapshot {
  targetType: ProcessOrderReceivingTargetType
  targetBusinessId: string
  targetName: string
  targetFactoryId?: string
  targetFactoryName?: string
  targetWarehouseId: string
  targetWarehouseName: string
  downstreamOrderId?: string
  downstreamOrderNo?: string
  downstreamDetailId?: string
  downstreamOccurrenceId?: string
  resolvedFrom: string
  resolvedAt: string
  frozenAt?: string
  firstHandoverEventId?: string
}

function assertFiniteNonNegative(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${fieldName}必须是大于或等于 0 的有限数`)
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

export function deriveProcessOrderReceiptStatus(input: {
  sourceAvailableQty: number
  expectedQty: number
  receivedQty: number
  unresolvedDifferenceQty?: number
}): ProcessOrderReceiptStatus {
  assertFiniteNonNegative(input.sourceAvailableQty, '来源可收数量')
  assertFiniteNonNegative(input.expectedQty, '应收数量')
  assertFiniteNonNegative(input.receivedQty, '累计实收数量')
  assertFiniteNonNegative(input.unresolvedDifferenceQty ?? 0, '未处理差异数量')
  if ((input.unresolvedDifferenceQty ?? 0) > 0 || input.receivedQty > input.expectedQty) return 'RECEIPT_DIFFERENCE'
  if (input.expectedQty > 0 && input.receivedQty >= input.expectedQty) return 'RECEIVED'
  if (input.receivedQty > 0) return 'PARTIAL_RECEIVED'
  return input.sourceAvailableQty > 0 ? 'WAIT_RECEIVE' : 'WAIT_SOURCE'
}

export function deriveProcessOrderProcessingStatus(input: {
  startedAt?: string
  manuallyCompletedAt?: string
  cancelledAt?: string
}): ProcessOrderProcessingStatus {
  if (input.cancelledAt) return 'CANCELLED'
  if (input.manuallyCompletedAt) return 'COMPLETED'
  return input.startedAt ? 'PROCESSING' : 'NOT_STARTED'
}

export function deriveProcessOrderHandoverStatus(input: {
  completedQty: number
  handedOverQty: number
  hasUnresolvedCorrection?: boolean
}): ProcessOrderHandoverStatus {
  assertFiniteNonNegative(input.completedQty, '累计完成数量')
  assertFiniteNonNegative(input.handedOverQty, '累计交出数量')
  if (input.handedOverQty > input.completedQty) throw new Error('累计交出数量不能超过累计完成数量')
  if (input.completedQty === 0) return 'NOT_READY'
  if (input.handedOverQty === 0) return 'WAIT_HANDOVER'
  if (input.handedOverQty < input.completedQty || input.hasUnresolvedCorrection) return 'PARTIAL_HANDOVER'
  return 'FULL_HANDOVER'
}

export function calculateProcessOrderQuantities(input: {
  sourceTransferredOrHandedQty: number
  receivedQty: number
  completedQty: number
  handedOverQty: number
  downstreamReceivedQty: number
}) {
  Object.entries(input).forEach(([field, value]) => assertFiniteNonNegative(value, field))
  if (input.receivedQty > input.sourceTransferredOrHandedQty) throw new Error('累计实收不能超过来源累计有效调拨或交出数量')
  if (input.handedOverQty > input.completedQty) throw new Error('累计交出不能超过累计有效加工完成数量')
  if (input.downstreamReceivedQty > input.handedOverQty) throw new Error('下游累计实收不能超过本单累计有效交出数量')
  return {
    receivableQty: roundQuantity(input.sourceTransferredOrHandedQty - input.receivedQty),
    handoverableQty: roundQuantity(input.completedQty - input.handedOverQty),
    downstreamPendingReceiptQty: roundQuantity(input.handedOverQty - input.downstreamReceivedQty),
  }
}

export function assertSingleReceivingTarget(
  targets: readonly ProcessOrderReceivingTargetSnapshot[],
): ProcessOrderReceivingTargetSnapshot {
  const uniqueTargets = [...new Map(targets.map((target) => [
    [target.targetType, target.targetBusinessId, target.targetWarehouseId, target.downstreamOrderId || ''].join(':'),
    target,
  ])).values()]
  if (uniqueTargets.length === 0) throw new Error('尚未生成唯一接收方，暂不能交出')
  if (uniqueTargets.length > 1) throw new Error('当前加工单存在多个接收方，必须在交出前拆成独立加工单')
  return structuredClone(uniqueTargets[0])
}

export function freezeProcessOrderReceivingTarget(input: {
  current?: ProcessOrderReceivingTargetSnapshot
  resolved: ProcessOrderReceivingTargetSnapshot
  handoverEventId: string
  handedOverAt: string
}): ProcessOrderReceivingTargetSnapshot {
  if (!input.handoverEventId.trim() || !input.handedOverAt.trim()) throw new Error('冻结接收方必须引用首次有效交出事件和时间')
  if (input.current?.firstHandoverEventId) {
    const currentKey = [input.current.targetType, input.current.targetBusinessId, input.current.targetWarehouseId, input.current.downstreamOrderId || ''].join(':')
    const resolvedKey = [input.resolved.targetType, input.resolved.targetBusinessId, input.resolved.targetWarehouseId, input.resolved.downstreamOrderId || ''].join(':')
    if (currentKey !== resolvedKey) throw new Error('首次有效交出后接收方已冻结；请先更正或撤销原交出记录')
    return structuredClone(input.current)
  }
  return {
    ...structuredClone(input.resolved),
    frozenAt: input.handedOverAt,
    firstHandoverEventId: input.handoverEventId,
  }
}
