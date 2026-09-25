import {
  buildProcessTasksForProductionOrder,
  type CoveredProcessScope,
  type ProductionTaskUnitType,
} from './process-tasks.ts'
import { productionOrders } from './production-orders.ts'
import { listPrintWorkOrderSourceReferences, getPrintWorkOrderStatusLabel } from './printing-task-domain.ts'
import { listDyeWorkOrderSourceReferences, getDyeWorkOrderStatusLabel } from './dyeing-task-domain.ts'

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
  // 预览仅展示已存在加工单的归属和状态，不初始化工厂执行、领料或交出。
  const processWorkOrders: ProductionTaskBreakdownPreviewWorkOrder[] = [
    ...listPrintWorkOrderSourceReferences()
      .filter(item => (item.productionOrderIds ?? []).includes(order.productionOrderId))
      .map(item => ({ workOrderId: item.printOrderId, workOrderNo: item.printOrderNo,
        processCode: 'PRINT' as const, factoryName: item.printFactoryName,
        statusLabel: item.printFactoryId ? getPrintWorkOrderStatusLabel(item.status) : '待分配工厂' })),
    ...listDyeWorkOrderSourceReferences()
      .filter(item => (item.productionOrderIds ?? []).includes(order.productionOrderId))
      .map(item => ({ workOrderId: item.dyeOrderId, workOrderNo: item.dyeOrderNo,
        processCode: 'DYE' as const, factoryName: item.dyeFactoryName,
        statusLabel: item.dyeFactoryId ? getDyeWorkOrderStatusLabel(item.status) : '待分配工厂' })),
  ].sort((left, right) => left.workOrderNo.localeCompare(right.workOrderNo))
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
