export type PostExecutionMode = 'SEW_FACTORY_INCLUDES_POST' | 'MANAGED_POST_FACTORY_EXECUTES'

export type PostRouteCurrentNode =
  | 'WAIT_SEW_HANDOVER'
  | 'WAIT_RECEIVER_WRITEBACK'
  | 'WAIT_RECEIVING_QC'
  | 'WAIT_POST_EXECUTION'
  | 'WAIT_FINAL_RECHECK'
  | 'WAIT_WAREHOUSE_HANDOVER'
  | 'CLOSED'

export interface PostProcessRoute {
  postRouteId: string
  productionOrderId: string
  productionOrderNo: string
  sewingTaskId: string
  sewingTaskNo: string
  postTaskId?: string
  postTaskNo?: string
  postExecutionMode: PostExecutionMode
  sewingFactoryId: string
  sewingFactoryName: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  finishedWarehouseId: string
  finishedWarehouseName: string
  requiresReceivingQc: boolean
  requiresPostExecution: boolean
  requiresFinalRecheck: boolean
  currentNode: PostRouteCurrentNode
  createdAt: string
  updatedAt: string
}

export const POST_EXECUTION_MODE_LABEL: Record<PostExecutionMode, string> = {
  SEW_FACTORY_INCLUDES_POST: '车缝厂含后道',
  MANAGED_POST_FACTORY_EXECUTES: '我方后道工厂执行后道',
}

export const POST_ROUTE_NODE_LABEL: Record<PostRouteCurrentNode, string> = {
  WAIT_SEW_HANDOVER: '待车缝交出',
  WAIT_RECEIVER_WRITEBACK: '待接收方回写',
  WAIT_RECEIVING_QC: '待回货质检',
  WAIT_POST_EXECUTION: '待后道',
  WAIT_FINAL_RECHECK: '待复检',
  WAIT_WAREHOUSE_HANDOVER: '待交成衣仓',
  CLOSED: '已关闭',
}

const ROUTE_SEEDS: PostProcessRoute[] = [
  {
    postRouteId: 'POST-ROUTE-202603-0002',
    productionOrderId: 'PO-202603-0002',
    productionOrderNo: 'PO-202603-0002',
    sewingTaskId: 'TASK-RIB-202603-0002',
    sewingTaskNo: 'TASK-RIB-202603-0002',
    postExecutionMode: 'SEW_FACTORY_INCLUDES_POST',
    sewingFactoryId: 'ID-F001',
    sewingFactoryName: 'PT Sinar Garment Indonesia',
    managedPostFactoryId: 'POST-FACTORY-OWN',
    managedPostFactoryName: '我方后道工厂',
    finishedWarehouseId: 'WH-GARMENT-HANDOFF',
    finishedWarehouseName: '成衣仓交接点',
    requiresReceivingQc: true,
    requiresPostExecution: false,
    requiresFinalRecheck: true,
    currentNode: 'WAIT_FINAL_RECHECK',
    createdAt: '2026-03-08 15:20:00',
    updatedAt: '2026-03-08 18:10:00',
  },
  {
    postRouteId: 'POST-ROUTE-202603-0003',
    productionOrderId: 'PO-202603-0003',
    productionOrderNo: 'PO-202603-0003',
    sewingTaskId: 'TASK-RIB-202603-0003',
    sewingTaskNo: 'TASK-RIB-202603-0003',
    postTaskId: 'TASK-POST-202603-0003',
    postTaskNo: 'TASK-POST-202603-0003',
    postExecutionMode: 'MANAGED_POST_FACTORY_EXECUTES',
    sewingFactoryId: 'ID-F004',
    sewingFactoryName: 'PT Mulia Cutting Center',
    managedPostFactoryId: 'POST-FACTORY-OWN',
    managedPostFactoryName: '我方后道工厂',
    finishedWarehouseId: 'WH-GARMENT-HANDOFF',
    finishedWarehouseName: '成衣仓交接点',
    requiresReceivingQc: true,
    requiresPostExecution: true,
    requiresFinalRecheck: true,
    currentNode: 'WAIT_POST_EXECUTION',
    createdAt: '2026-03-09 10:50:00',
    updatedAt: '2026-03-09 11:30:00',
  },
  {
    postRouteId: 'POST-ROUTE-202603-0004',
    productionOrderId: 'PO-202603-0004',
    productionOrderNo: 'PO-202603-0004',
    sewingTaskId: 'TASK-RIB-202603-0004',
    sewingTaskNo: 'TASK-RIB-202603-0004',
    postExecutionMode: 'SEW_FACTORY_INCLUDES_POST',
    sewingFactoryId: 'ID-F001',
    sewingFactoryName: 'PT Sinar Garment Indonesia',
    managedPostFactoryId: 'POST-FACTORY-OWN',
    managedPostFactoryName: '我方后道工厂',
    finishedWarehouseId: 'WH-GARMENT-HANDOFF',
    finishedWarehouseName: '成衣仓交接点',
    requiresReceivingQc: true,
    requiresPostExecution: false,
    requiresFinalRecheck: true,
    currentNode: 'WAIT_WAREHOUSE_HANDOVER',
    createdAt: '2026-03-10 08:40:00',
    updatedAt: '2026-03-10 09:45:00',
  },
  {
    postRouteId: 'POST-ROUTE-202603-0005',
    productionOrderId: 'PO-202603-0005',
    productionOrderNo: 'PO-202603-0005',
    sewingTaskId: 'TASK-RIB-202603-0005',
    sewingTaskNo: 'TASK-RIB-202603-0005',
    postExecutionMode: 'SEW_FACTORY_INCLUDES_POST',
    sewingFactoryId: 'ID-F001',
    sewingFactoryName: 'PT Sinar Garment Indonesia',
    managedPostFactoryId: 'POST-FACTORY-OWN',
    managedPostFactoryName: '我方后道工厂',
    finishedWarehouseId: 'WH-GARMENT-HANDOFF',
    finishedWarehouseName: '成衣仓交接点',
    requiresReceivingQc: true,
    requiresPostExecution: false,
    requiresFinalRecheck: true,
    currentNode: 'WAIT_FINAL_RECHECK',
    createdAt: '2026-03-11 08:10:00',
    updatedAt: '2026-03-11 09:10:00',
  },
  {
    postRouteId: 'POST-ROUTE-202603-0006',
    productionOrderId: 'PO-202603-0006',
    productionOrderNo: 'PO-202603-0006',
    sewingTaskId: 'TASK-RIB-202603-0006',
    sewingTaskNo: 'TASK-RIB-202603-0006',
    postTaskId: 'TASK-POST-202603-0006',
    postTaskNo: 'TASK-POST-202603-0006',
    postExecutionMode: 'MANAGED_POST_FACTORY_EXECUTES',
    sewingFactoryId: 'ID-F001',
    sewingFactoryName: 'PT Sinar Garment Indonesia',
    managedPostFactoryId: 'POST-FACTORY-OWN',
    managedPostFactoryName: '我方后道工厂',
    finishedWarehouseId: 'WH-GARMENT-HANDOFF',
    finishedWarehouseName: '成衣仓交接点',
    requiresReceivingQc: true,
    requiresPostExecution: true,
    requiresFinalRecheck: true,
    currentNode: 'WAIT_POST_EXECUTION',
    createdAt: '2026-03-11 13:50:00',
    updatedAt: '2026-03-11 16:20:00',
  },
  {
    postRouteId: 'POST-ROUTE-202603-0008',
    productionOrderId: 'PO-202603-0008',
    productionOrderNo: 'PO-202603-0008',
    sewingTaskId: 'TASK-RIB-202603-0008',
    sewingTaskNo: 'TASK-RIB-202603-0008',
    postTaskId: 'TASK-POST-202603-0008',
    postTaskNo: 'TASK-POST-202603-0008',
    postExecutionMode: 'MANAGED_POST_FACTORY_EXECUTES',
    sewingFactoryId: 'ID-F001',
    sewingFactoryName: 'PT Sinar Garment Indonesia',
    managedPostFactoryId: 'POST-FACTORY-OWN',
    managedPostFactoryName: '我方后道工厂',
    finishedWarehouseId: 'WH-GARMENT-HANDOFF',
    finishedWarehouseName: '成衣仓交接点',
    requiresReceivingQc: true,
    requiresPostExecution: true,
    requiresFinalRecheck: true,
    currentNode: 'WAIT_FINAL_RECHECK',
    createdAt: '2026-03-12 14:40:00',
    updatedAt: '2026-03-12 16:25:00',
  },
  {
    postRouteId: 'POST-ROUTE-202603-0015',
    productionOrderId: 'PO-202603-0015',
    productionOrderNo: 'PO-202603-0015',
    sewingTaskId: 'TASK-RIB-202603-0015',
    sewingTaskNo: 'TASK-RIB-202603-0015',
    postExecutionMode: 'SEW_FACTORY_INCLUDES_POST',
    sewingFactoryId: 'ID-F001',
    sewingFactoryName: 'PT Sinar Garment Indonesia',
    managedPostFactoryId: 'POST-FACTORY-OWN',
    managedPostFactoryName: '我方后道工厂',
    finishedWarehouseId: 'WH-GARMENT-HANDOFF',
    finishedWarehouseName: '成衣仓交接点',
    requiresReceivingQc: true,
    requiresPostExecution: false,
    requiresFinalRecheck: true,
    currentNode: 'CLOSED',
    createdAt: '2026-03-16 08:20:00',
    updatedAt: '2026-03-20 17:00:00',
  },
]

export function listPostProcessRoutes(): PostProcessRoute[] {
  return ROUTE_SEEDS.map((item) => ({ ...item }))
}

export function getPostProcessRouteByProductionOrderId(productionOrderId?: string): PostProcessRoute | null {
  if (!productionOrderId) return null
  return ROUTE_SEEDS.find((item) => item.productionOrderId === productionOrderId) ?? null
}

export function getPostProcessRouteByTaskId(taskId?: string): PostProcessRoute | null {
  if (!taskId) return null
  return ROUTE_SEEDS.find((item) => item.sewingTaskId === taskId || item.postTaskId === taskId) ?? null
}

export function getPostExecutionModeLabel(mode?: PostExecutionMode): string {
  return mode ? POST_EXECUTION_MODE_LABEL[mode] : '未配置'
}

export function getPostRouteNodeLabel(node?: PostRouteCurrentNode): string {
  return node ? POST_ROUTE_NODE_LABEL[node] : '未配置'
}

function hasReached(node: PostRouteCurrentNode, target: PostRouteCurrentNode): boolean {
  const order: PostRouteCurrentNode[] = [
    'WAIT_SEW_HANDOVER',
    'WAIT_RECEIVER_WRITEBACK',
    'WAIT_RECEIVING_QC',
    'WAIT_POST_EXECUTION',
    'WAIT_FINAL_RECHECK',
    'WAIT_WAREHOUSE_HANDOVER',
    'CLOSED',
  ]
  return order.indexOf(node) >= order.indexOf(target)
}

export function getPostRouteProgress(route: PostProcessRoute) {
  return {
    receivingQcLabel: hasReached(route.currentNode, 'WAIT_POST_EXECUTION') || hasReached(route.currentNode, 'WAIT_FINAL_RECHECK')
      ? '已完成'
      : route.currentNode === 'WAIT_RECEIVING_QC'
        ? '待回货质检'
        : '待接收方回写',
    postExecutionLabel: route.requiresPostExecution
      ? hasReached(route.currentNode, 'WAIT_FINAL_RECHECK')
        ? '已完成'
        : route.currentNode === 'WAIT_POST_EXECUTION'
          ? '待后道'
          : '待回货质检'
      : '车缝厂含后道',
    finalRecheckLabel: hasReached(route.currentNode, 'WAIT_WAREHOUSE_HANDOVER') || route.currentNode === 'CLOSED'
      ? '已完成'
      : route.currentNode === 'WAIT_FINAL_RECHECK'
        ? '待复检'
        : route.requiresPostExecution
          ? '待后道'
          : '待回货质检',
    warehouseHandoverLabel: route.currentNode === 'CLOSED'
      ? '已关闭'
      : route.currentNode === 'WAIT_WAREHOUSE_HANDOVER'
        ? '待交成衣仓'
        : '待复检',
  }
}
