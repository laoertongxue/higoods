import {
  deriveProcessOrderHandoverStatus,
  deriveProcessOrderProcessingStatus,
  deriveProcessOrderReceiptStatus,
  type ProcessOrderHandoverStatus,
  type ProcessOrderInputSourceType,
  type ProcessOrderProcessingStatus,
  type ProcessOrderReceiptStatus,
} from './process-order-flow-contract.ts'
import { getProcessOrderTaskRelationView } from './process-order-task-links.ts'
import { getDyeMaterialReceiptOptions } from './dyeing-material-receipts.ts'
import { getPreparationMaterialSourceDocumentNo } from './preparation-material-receipt-sources.ts'
import {
  getDyeOrderHandoverSummary,
  listDyeExecutionNodeRecords,
  type DyeWorkOrder,
} from './dyeing-task-domain.ts'
import { getWaterSolubleMaterialReceiptOptions } from './water-soluble-material-receipts.ts'
import type { WaterSolubleWorkOrder } from './water-soluble-task-domain.ts'
import { getProductionOrderProcessEntries } from './production-order-tech-pack-runtime.ts'

export interface ProcessOrderReceiverView {
  ready: boolean
  receiverName: string
  receiverWarehouseName: string
  downstreamOrderNo?: string
  blockReason?: string
}

export interface ProcessOrderThreeAxisView {
  receiptStatus: ProcessOrderReceiptStatus
  processingStatus: ProcessOrderProcessingStatus
  handoverStatus: ProcessOrderHandoverStatus
  sourceMode: ProcessOrderInputSourceType | 'UNRESOLVED'
  sourceDocumentNos: string[]
  receivedInputQty: number
  completedQty: number
  handedOverQty: number
  downstreamReceivedQty: number
  receiver: ProcessOrderReceiverView
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map(value => value?.trim() || '').filter(Boolean))]
}

function deriveReceiverView(input: {
  documentId: string
  sourceType: 'PRODUCTION_ORDER' | 'STOCK' | 'CUT_PIECE_SUPPLEMENT'
  productionOrderNo?: string
  bomItemIds?: readonly string[]
}): ProcessOrderReceiverView {
  const relation = getProcessOrderTaskRelationView(input.documentId)
  if (!relation) return {
    ready: false,
    receiverName: '路线关系待确认',
    receiverWarehouseName: '暂不能交出',
    blockReason: '未找到加工单对应的正式路线。',
  }
  const currentBomItemIds = new Set((input.bomItemIds?.length ? input.bomItemIds : relation.current.bomItemIds).filter(Boolean))
  const currentRouteObjectKeys = new Set(relation.current.routeObjectKeys ?? [])
  const matchesCurrentObjectBranch = (candidate: { bomItemIds?: readonly string[]; routeObjectKeys?: readonly string[] }): boolean => {
    const candidateBomItemIds = candidate.bomItemIds ?? []
    const candidateRouteObjectKeys = candidate.routeObjectKeys ?? []
    if (currentRouteObjectKeys.size > 0 && candidateRouteObjectKeys.some(key => currentRouteObjectKeys.has(key))) return true
    if (currentBomItemIds.size > 0 && candidateBomItemIds.some(id => currentBomItemIds.has(id))) return true
    if ((currentRouteObjectKeys.size > 0 || currentBomItemIds.size > 0) && (candidateRouteObjectKeys.length > 0 || candidateBomItemIds.length > 0)) return false
    return true
  }
  const successors = relation.successors.filter(document => document.documentKind !== 'SOURCE_DOCUMENT').filter(matchesCurrentObjectBranch)
  const processEntries = relation.current.productionOrderId ? getProductionOrderProcessEntries(relation.current.productionOrderId) : []
  const pendingSuccessors = relation.pendingSuccessors.filter(pending => {
    const entry = processEntries.find(item => item.id === pending.occurrenceEntryId)
    return matchesCurrentObjectBranch({
      bomItemIds: entry?.linkedBomItemIds,
      routeObjectKeys: [entry?.routeObjectKey].filter((value): value is string => Boolean(value)),
    })
  })
  if (successors.length > 1 || pendingSuccessors.length > 1) return {
    ready: false,
    receiverName: '需按下游工序拆分加工单',
    receiverWarehouseName: '暂不能交出',
    blockReason: '一个加工单只能对应一个下游接收方。',
  }
  const successor = successors[0]
  if (successor) return {
    ready: true,
    receiverName: `${successor.processName}加工单 ${successor.documentNo}`,
    receiverWarehouseName: `${successor.processName}待加工仓`,
    downstreamOrderNo: successor.documentNo,
  }
  if (pendingSuccessors.length === 1) return {
    ready: false,
    receiverName: `${pendingSuccessors[0].processName}加工单待生成`,
    receiverWarehouseName: '暂不能交出',
    blockReason: '直接下游加工单尚未生成。',
  }
  if (input.sourceType === 'STOCK') return {
    ready: true,
    receiverName: '中央仓库',
    receiverWarehouseName: '中央仓库',
  }
  if (input.sourceType === 'CUT_PIECE_SUPPLEMENT') return {
    ready: true,
    receiverName: '补料需求方',
    receiverWarehouseName: '补料指定接收位置',
  }
  const orderNo = input.productionOrderNo || relation.current.productionOrderNo || relation.current.productionOrderId || '生产单'
  return {
    ready: true,
    receiverName: `${orderNo} 裁床`,
    receiverWarehouseName: `${orderNo} 配套中转仓`,
  }
}

export function getDyeWorkOrderThreeAxisView(order: DyeWorkOrder): ProcessOrderThreeAxisView {
  const source = getDyeMaterialReceiptOptions(order.dyeOrderId)
  const receivedInputQty = (order.materialReceipts ?? []).reduce((sum, item) => sum + item.qty, 0)
  const sourceAvailableQty = source.options.reduce((sum, item) => sum + item.availableQty, 0)
  const currentNodes = listDyeExecutionNodeRecords(order.dyeOrderId)
  const executionNodes = [...(order.completedExecutionBatches ?? []).flat(), ...currentNodes]
  const dyeStarts = executionNodes.filter(node => node.nodeCode === 'DYE').map(node => node.startedAt).filter((value): value is string => Boolean(value))
  const packFinishes = executionNodes.filter(node => node.nodeCode === 'PACK' && node.finishedAt)
  const completedQty = packFinishes.reduce((sum, node) => sum + (node.outputQty ?? 0), 0)
  const usedQty = executionNodes.filter(node => node.nodeCode === 'DYE' && node.startedAt)
    .reduce((sum, node) => sum + (node.inputQty ?? 0), 0)
  // A finished batch remains in progress while planned input or the current batch is outstanding.
  const hasCurrentPackFinish = currentNodes.some(node => node.nodeCode === 'PACK' && node.finishedAt)
  const scopeFinished = order.plannedQty > 0 && hasCurrentPackFinish
    && ((receivedInputQty >= order.plannedQty && usedQty >= receivedInputQty)
      || (dyeStarts.length === 0 && completedQty >= order.plannedQty))
  const completedAt = order.documentCompletedAt
    || (scopeFinished ? packFinishes.map(node => node.finishedAt!).sort().at(-1) : undefined)
  const summary = getDyeOrderHandoverSummary(order.dyeOrderId)
  return {
    receiptStatus: deriveProcessOrderReceiptStatus({ sourceAvailableQty, expectedQty: order.plannedQty, receivedQty: receivedInputQty }),
    processingStatus: !completedAt && dyeStarts.length === 0 && packFinishes.length > 0 ? 'PROCESSING' : deriveProcessOrderProcessingStatus({
      startedAt: dyeStarts.sort()[0],
      manuallyCompletedAt: completedAt,
    }),
    handoverStatus: deriveProcessOrderHandoverStatus({ completedQty, handedOverQty: summary.submittedQty }),
    sourceMode: source.sourceMode,
    sourceDocumentNos: unique([
      ...source.options.map(item => item.documentNo),
      ...(order.materialReceipts ?? []).map(item => getPreparationMaterialSourceDocumentNo(item.upstreamRecordId) || item.upstreamRecordId),
    ]),
    receivedInputQty,
    completedQty,
    handedOverQty: summary.submittedQty,
    downstreamReceivedQty: summary.writtenBackQty,
    receiver: deriveReceiverView({
      documentId: order.dyeOrderId,
      sourceType: order.sourceType,
      productionOrderNo: order.sourceProductionOrderNo,
      bomItemIds: [order.sourceSnapshot?.bomItemId, ...(order.sourceSnapshot?.bomItemIds ?? [])].filter((value): value is string => Boolean(value)),
    }),
  }
}

export function getWaterSolubleWorkOrderThreeAxisView(order: WaterSolubleWorkOrder): ProcessOrderThreeAxisView {
  const source = getWaterSolubleMaterialReceiptOptions(order.waterOrderId)
  const receivedInputQty = (order.materialReceipts ?? []).reduce((sum, item) => sum + item.qty, 0)
  const sourceAvailableQty = source.options.reduce((sum, item) => sum + item.availableQty, 0)
  const startedAt = order.actionLogs.find(log => log.action === '开始水溶')?.at
  const completedAt = [...order.actionLogs].reverse().find(log => ['完成水溶', '主管确认按实际数量继续'].includes(log.action))?.at
  const handedOverQty = order.handoverQty ?? 0
  return {
    receiptStatus: deriveProcessOrderReceiptStatus({ sourceAvailableQty, expectedQty: order.plannedQty, receivedQty: receivedInputQty }),
    processingStatus: deriveProcessOrderProcessingStatus({ startedAt, manuallyCompletedAt: completedAt }),
    handoverStatus: deriveProcessOrderHandoverStatus({ completedQty: order.completedQty, handedOverQty }),
    sourceMode: source.sourceMode,
    sourceDocumentNos: unique([
      ...source.options.map(item => item.documentNo),
      ...(order.materialReceipts ?? []).map(item => getPreparationMaterialSourceDocumentNo(item.upstreamRecordId) || item.upstreamRecordId),
    ]),
    receivedInputQty,
    completedQty: order.completedQty,
    handedOverQty,
    downstreamReceivedQty: order.receivedQty ?? 0,
    receiver: deriveReceiverView({
      documentId: order.waterOrderId,
      sourceType: 'PRODUCTION_ORDER',
      productionOrderNo: order.productionOrderNo,
      bomItemIds: [order.bomItemId],
    }),
  }
}
