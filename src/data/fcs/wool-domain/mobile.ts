import type { ProcessTask } from '../process-tasks.ts'
import {
  getWoolAllowedActions,
  getWoolProcessingStatus,
  getWoolWorkOrderById,
  getWoolWorkOrderReadinessProjection,
  listWoolWorkOrders,
} from './queries.ts'
import type { WoolAllowedAction } from './queries.ts'
import type { WoolWorkOrder } from './types.ts'

export interface WoolMobileTaskProjection {
  woolOrderId: string
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  processingStatus: 'UNPROCESSED' | 'PROCESSING' | 'COMPLETED'
  processingStatusLabel: '未加工' | '加工中' | '已完成'
  allowedActions: WoolAllowedAction[]
  requiredYarnSkus: string[]
  confirmedYarnSkus: string[]
  missingYarnSkus: string[]
  readyOutputSkuCodes: string[]
}

const STATUS_LABELS: Record<WoolMobileTaskProjection['processingStatus'], WoolMobileTaskProjection['processingStatusLabel']> = {
  UNPROCESSED: '未加工',
  PROCESSING: '加工中',
  COMPLETED: '已完成',
}

export function buildWoolMobileTaskProjection(
  woolOrderId: string,
): WoolMobileTaskProjection {
  const order = getWoolWorkOrderById(woolOrderId)
  if (!order) throw new Error(`找不到毛织加工单 ${woolOrderId}`)
  const readiness = getWoolWorkOrderReadinessProjection(order.woolOrderId)
  const outputs = [...readiness.outputsBySku.values()]
  const requiredYarnSkus = [...new Set(outputs.flatMap((item) =>
    item.readiness.requiredYarnSkus,
  ))]
  const confirmedYarnSkus = requiredYarnSkus.filter((sku) =>
    readiness.yarnReceiptsBySku.get(sku)?.isReceived,
  )
  const missingYarnSkus = requiredYarnSkus.filter((sku) =>
    !readiness.yarnReceiptsBySku.get(sku)?.isReceived,
  )
  const processingStatus = getWoolProcessingStatus(order.woolOrderId)
  return {
    woolOrderId: order.woolOrderId,
    taskId: order.taskId,
    taskNo: order.taskNo,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    processingStatus,
    processingStatusLabel: STATUS_LABELS[processingStatus],
    allowedActions: getWoolAllowedActions(order.woolOrderId),
    requiredYarnSkus,
    confirmedYarnSkus,
    missingYarnSkus,
    readyOutputSkuCodes: order.outputPlanLines
      .filter((line) => readiness.outputsBySku.get(line.outputSkuCode)?.readiness.canReport)
      .map((line) => line.outputSkuCode),
  }
}

function buildWoolMobileTask(order: WoolWorkOrder, index: number): ProcessTask {
  const projection = buildWoolMobileTaskProjection(order.woolOrderId)
  const totalPlannedQty = order.outputPlanLines.reduce((sum, line) => sum + line.plannedQty, 0)
  const qtyUnit = order.outputPlanLines[0]?.qtyUnit || (order.kind === 'PART_PANEL' ? '片' : '件')
  const status: ProcessTask['status'] = projection.processingStatus === 'COMPLETED'
    ? 'DONE'
    : projection.processingStatus === 'PROCESSING'
      ? 'IN_PROGRESS'
      : 'NOT_STARTED'
  return {
    taskId: order.taskId,
    taskNo: order.taskNo,
    rootTaskNo: order.woolOrderNo,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    seq: index + 1,
    processCode: 'PROC_WOOL',
    processNameZh: '毛织',
    processBusinessCode: 'WOOL',
    processBusinessName: '毛织',
    stage: 'SPECIAL',
    qty: totalPlannedQty,
    qtyUnit: qtyUnit as ProcessTask['qtyUnit'],
    qtyDisplayUnit: qtyUnit,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['FINISHING'] },
    assignedFactoryId: order.factoryId,
    assignedFactoryName: order.factoryName,
    qcPoints: [],
    attachments: [],
    status,
    taskDeadline: order.plannedCompletionAt,
    dispatchedAt: order.plannedStartAt || order.createdAt,
    dispatchedBy: order.createdBy,
    finishedAt: projection.processingStatus === 'COMPLETED'
      ? order.updatedAt
      : undefined,
    receiverId: order.downstreamTarget.receiverId,
    receiverName: order.downstreamTarget.receiverName,
    woolOrderId: order.woolOrderId,
    woolProcessingStatus: projection.processingStatus,
    woolAllowedActions: [...projection.allowedActions],
    woolRequiredYarnSkus: [...projection.requiredYarnSkus],
    woolConfirmedYarnSkus: [...projection.confirmedYarnSkus],
    woolMissingYarnSkus: [...projection.missingYarnSkus],
    woolReadyOutputSkuCodes: [...projection.readyOutputSkuCodes],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    auditLogs: [],
  } as ProcessTask
}

export function listWoolMobileProcessTasks(): ProcessTask[] {
  return listWoolWorkOrders().map(buildWoolMobileTask)
}
