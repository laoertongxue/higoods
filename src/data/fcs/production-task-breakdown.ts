import {
  buildProcessTasksForProductionOrder,
  type CoveredProcessScope,
  type ProductionTaskUnitType,
} from './process-tasks.ts'
import { productionOrders } from './production-orders.ts'
import { listProcessWorkOrders } from './process-work-order-domain.ts'

export interface ProductionTaskBreakdownPreviewTask {
  taskId: string
  taskName: string
  taskUnitType: ProductionTaskUnitType
  coveredProcesses: CoveredProcessScope[]
  assignedFactoryName?: string
  allowAutoDispatch: boolean
}

export interface ProductionTaskBreakdownPreviewWorkOrder {
  workOrderId: string
  workOrderNo: string
  processCode: 'PRINT' | 'DYE'
  factoryName: string
  statusLabel: string
}

export interface ProductionTaskBreakdownPreview {
  productionOrderId: string
  productionOrderNo: string
  saleType: string
  status: 'READY' | 'BLOCKED'
  statusReason: string
  blockedReasons: string[]
  generatedTasks: ProductionTaskBreakdownPreviewTask[]
  processWorkOrders: ProductionTaskBreakdownPreviewWorkOrder[]
}

export function buildProductionTaskBreakdownPreview(orderId: string): ProductionTaskBreakdownPreview {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  if (!order) {
    return {
      productionOrderId: orderId,
      productionOrderNo: orderId,
      saleType: '-',
      status: 'BLOCKED',
      statusReason: '生产单不存在',
      blockedReasons: ['生产单不存在'],
      generatedTasks: [],
      processWorkOrders: [],
    }
  }

  const tasks = buildProcessTasksForProductionOrder(order, order.updatedAt, '系统')
  const processWorkOrders = listProcessWorkOrders()
    .filter((item) =>
      (item.processType === 'PRINT' || item.processType === 'DYE')
      && item.productionOrderIds.includes(order.productionOrderId),
    )
    .map((item) => ({
      workOrderId: item.workOrderId,
      workOrderNo: item.workOrderNo,
      processCode: item.processType as 'PRINT' | 'DYE',
      factoryName: item.factoryName,
      statusLabel: item.statusLabel,
    }))
  const blockedReasons = tasks.length === 0 ? ['技术包没有可生成的生产任务'] : []

  return {
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    saleType: order.demandSnapshot.saleType,
    status: blockedReasons.length > 0 ? 'BLOCKED' : 'READY',
    statusReason: blockedReasons.length > 0 ? blockedReasons.join('、') : `将生成 ${tasks.length} 张生产任务`,
    blockedReasons,
    generatedTasks: tasks.map((task) => ({
      taskId: task.taskId,
      taskName: task.processNameZh,
      taskUnitType: task.taskUnitType ?? 'SINGLE_PROCESS_TASK',
      coveredProcesses: task.coveredProcesses ?? [],
      assignedFactoryName: task.assignedFactoryName,
      allowAutoDispatch: task.allowAutoDispatch !== false,
    })),
    processWorkOrders,
  }
}

export function buildProductionTaskBreakdownPreviews(orderIds: string[]): ProductionTaskBreakdownPreview[] {
  return orderIds.map(buildProductionTaskBreakdownPreview)
}
