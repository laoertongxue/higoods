import { productionOrders, type ProductionOrder } from './production-orders.ts'
import { getFactoryMasterRecordById } from './factory-master-store.ts'
import { cuttingMaterialPrepGroups } from './cutting/material-prep.ts'
import { listSpreadingResultGeneratedFeiTicketsByProductionOrderId } from './cutting/generated-fei-tickets.ts'
import {
  listFactoryInternalWarehouses,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
  listFactoryWarehouseStocktakeDifferenceReviews,
  listFactoryWarehouseStocktakeOrders,
} from './factory-internal-warehouse.ts'
import {
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
  listQuantityObjections,
  listReceiverWritebacks,
} from './pda-handover-events.ts'
import {
  getSpecialCraftTasksByProductionOrder,
  listSpecialCraftTaskWorkOrderLines,
  listSpecialCraftTaskWorkOrders,
  listSpecialCraftTaskOrders,
  type SpecialCraftTaskStatus,
} from './special-craft-task-orders.ts'
import { getSpecialCraftFlowRule, getSpecialCraftOperationById } from './special-craft-operations.ts'

// 统计结果只作为只读投影，不作为状态源头。
const DEMO_TODAY = '2026-04-23'
const SEWING_FACTORY_TYPES = new Set(['CENTRAL_GARMENT', 'SATELLITE_SEWING', 'THIRD_SEWING'])
const PROGRESS_URGENCY_SORT_WEIGHT: Record<string, number> = {
  十万火急: 4,
  '紧急 A': 3,
  '紧急 B': 2,
  C: 1,
  D: 0,
}

export interface ProgressStatisticsBuildOptions {
  includeTestFactories?: boolean
}

export interface ProgressBlockingReason {
  reasonId: string
  productionOrderId: string
  productionOrderNo: string
  sourceModule: '生产单' | '配料' | '领料' | '裁床' | '菲票' | '特殊工艺' | '交出单' | '交接' | '工厂仓库'
  sourceRecordNo: string
  blockingType: string
  blockingLabel: string
  severity: '普通' | '加急' | '紧急'
  canResolveInCurrentPrompt: boolean
  nextActionLabel: string
  relatedRoute: string
  createdAt: string
}

export interface ProductionProgressSnapshot {
  snapshotId: string
  productionOrderId: string
  productionOrderNo: string
  styleNo: string
  styleName: string
  totalQty: number
  dueDate: string
  urgencyLevel: string
  materialPrepStatus: '无配料数量' | '配料数量不足' | '有配料数量'
  cuttingPickupStatus: '无领料记录' | '有领料记录' | '差异待处理'
  cuttingStatus: '待裁剪' | '裁剪中' | '已裁剪' | '异常'
  feiTicketStatus: '未生成' | '部分生成' | '已生成'
  cuttingWaitHandoverStatus: '未入仓' | '部分入仓' | '已入裁床厂待交出仓'
  specialCraftStatus: '无特殊工艺' | '待交出' | '加工中' | '待回仓' | '已回仓' | '差异' | '异议中'
  specialCraftReturnStatus: '不需要回仓' | '未回仓' | '部分回仓' | '已回仓' | '差异' | '异议中'
  specialCraftTargetObjectSummary: string[]
  specialCraftWorkOrderCount: number
  specialCraftCurrentQty: number
  specialCraftScrapQty: number
  specialCraftDamageQty: number
  specialCraftDifferenceWarning: boolean
  sewingDispatchStatus: '未交出' | '部分交出' | '已全部交出' | '差异' | '异议中'
  sewingReceiveStatus: '未回写' | '部分回写' | '已回写' | '差异' | '异议中'
  pickupOrderCompleted: boolean
  handoutOrderCompleted: boolean
  transferBagCombinedWritebackStatus: string
  handoverStatus: '无交接' | '待回写' | '已回写' | '差异' | '异议中'
  differenceStatus: '无差异' | '差异'
  objectionStatus: '无异议' | '异议中'
  canProceedToSewingDispatch: boolean
  blockingReasons: ProgressBlockingReason[]
  nextActionLabel: string
  updatedAt: string
}

export interface CuttingProgressMetric {
  status: string
  plannedQty: number
  completedQty: number
  differenceQty: number
  abnormalCount: number
  lastUpdatedAt: string
}

export interface CuttingProgressSnapshot {
  snapshotId: string
  productionOrderId: string
  productionOrderNo: string
  cuttingOrderIds: string[]
  cuttingOrderNos: string[]
  materialPrepProgress: CuttingProgressMetric
  pickupProgress: CuttingProgressMetric
  markerProgress: CuttingProgressMetric
  spreadingProgress: CuttingProgressMetric
  cuttingProgress: CuttingProgressMetric
  feiTicketProgress: CuttingProgressMetric
  cutPieceWarehouseProgress: CuttingProgressMetric
  specialCraftDispatchProgress: CuttingProgressMetric
  specialCraftReturnProgress: CuttingProgressMetric
  sewingDispatchProgress: CuttingProgressMetric
  specialCraftCurrentQty: number
  specialCraftScrapQty: number
  specialCraftDamageQty: number
  specialCraftDifferenceWarning: boolean
  pickupOrderCompleted: boolean
  handoutOrderCompleted: boolean
  transferBagPackStatus: string
  transferBagCombinedWritebackStatus: string
  transferBagBagDifferenceCount: number
  transferBagFeiTicketDifferenceCount: number
  bundleLengthCmValues: number[]
  bundleWidthCmValues: number[]
  urgencyLevel: string
  blockingReasons: ProgressBlockingReason[]
  canCreateSewingDispatchBatch: boolean
  updatedAt: string
}

export interface SpecialCraftProgressSnapshot {
  snapshotId: string
  operationId: string
  operationName: string
  factoryId: string
  factoryName: string
  productionOrderId: string
  productionOrderNo: string
  targetObjectSummary: string[]
  supportedTargetObjectSummary: string[]
  workOrderCount: number
  taskCount: number
  planQty: number
  receivedQty: number
  completedQty: number
  waitHandoverQty: number
  waitDispatchFeiTicketCount: number
  dispatchedFeiTicketCount: number
  receivedFeiTicketCount: number
  processingFeiTicketCount: number
  waitReturnFeiTicketCount: number
  returnedFeiTicketCount: number
  differenceFeiTicketCount: number
  objectionFeiTicketCount: number
  abnormalCount: number
  blockingCount: number
  groupBy: '工艺'
  receiveDifferenceTicketCount: number
  returnDifferenceTicketCount: number
  scrapQty: number
  damageQty: number
  currentQty: number
  bundleWidthCmValues: number[]
  bundleLengthCmValues: number[]
  stripCountTotal: number
  statusDistribution: Record<SpecialCraftTaskStatus, number>
  updatedAt: string
}

export interface FactoryWarehouseProgressSnapshot {
  snapshotId: string
  factoryId: string
  factoryName: string
  waitProcessCount: number
  waitProcessQty: number
  waitHandoverCount: number
  waitHandoverQty: number
  todayInboundCount: number
  todayInboundQty: number
  todayOutboundCount: number
  todayOutboundQty: number
  inboundDifferenceCount: number
  outboundDifferenceCount: number
  objectionCount: number
  pickupCompletedOrderCount: number
  handoutCompletedOrderCount: number
  stocktakeDifferenceCount: number
  stocktakeWaitReviewCount: number
  stocktakeAdjustedCount: number
  overdueCount: number
  updatedAt: string
}

export interface HandoverProgressSnapshot {
  snapshotId: string
  productionOrderId: string
  productionOrderNo: string
  factoryId: string
  factoryName: string
  handoverOrderCount: number
  handoverRecordCount: number
  submittedQty: number
  receiverWrittenQty: number
  differenceQty: number
  pickupCompletedOrderCount: number
  handoutCompletedOrderCount: number
  receiverClosedCount: number
  waitWritebackCount: number
  writtenBackCount: number
  differenceCount: number
  objectionCount: number
  updatedAt: string
}

export interface SewingDispatchProgressSnapshot {
  snapshotId: string
  productionOrderId: string
  productionOrderNo: string
  totalProductionQty: number
  cumulativeDispatchedGarmentQty: number
  remainingGarmentQty: number
  dispatchOrderCount: number
  dispatchBatchCount: number
  transferOrderCount: number
  transferBagCount: number
  contentItemCount: number
  contentFeiTicketCount: number
  contentMaterialLineCount: number
  mixedTransferBagCount: number
  packedTransferBagCount: number
  receivedTransferBagCount: number
  receivedFeiTicketCount: number
  scannedReceivedTransferBagCount: number
  completedTransferBagCount: number
  dispatchedTransferBagCount: number
  writtenBackTransferBagCount: number
  bagWritebackLineCount: number
  feiTicketWritebackLineCount: number
  partialWrittenBackTransferBagCount: number
  partialWritebackTransferBagCount: number
  differenceTransferBagCount: number
  bagDifferenceCount: number
  feiTicketDifferenceCount: number
  objectionTransferBagCount: number
  canCreateNextBatch: boolean
  blockingReasons: string[]
  updatedAt: string
}

const sewingDispatchProgressSnapshotCache = new Map<string, SewingDispatchProgressSnapshot>()

export interface ProductionProgressKpiSummary {
  totalProductionOrders: number
  inProgressOrders: number
  blockedOrders: number
  readyForSewingDispatchOrders: number
  partiallyDispatchedOrders: number
  fullyDispatchedOrders: number
  differenceOrders: number
  objectionOrders: number
  urgentOrders: number
  updatedAt: string
}

export interface CuttingSpecialCraftReturnStatusSummary {
  productionOrderNo: string
  totalNeedSpecialCraftFeiTickets: number
  waitDispatchCount: number
  dispatchedCount: number
  receivedBySpecialFactoryCount: number
  completedCount: number
  waitReturnCount: number
  returnedCount: number
  differenceCount: number
  objectionCount: number
  allReturned: boolean
}

type CuttingSpecialCraftProjectionFlowStatus =
  | '待绑定'
  | '待发料'
  | '已发料'
  | '已接收'
  | '加工中'
  | '已完成'
  | '待回仓'
  | '已回仓'
  | '差异'
  | '异议中'
  | '异常'
  | '待确认顺序'

interface CuttingSpecialCraftProjectionBinding {
  bindingId: string
  productionOrderId: string
  productionOrderNo: string
  taskOrderId: string
  taskOrderNo: string
  demandLineId: string
  workOrderId: string
  operationId: string
  operationName: string
  targetFactoryId: string
  targetFactoryName: string
  feiTicketNo: string
  qty: number
  currentQty: number
  cumulativeScrapQty: number
  cumulativeDamageQty: number
  sequenceIndex: number
  specialCraftFlowStatus: CuttingSpecialCraftProjectionFlowStatus
  receiveDifferenceStatus?: '待处理' | '处理中' | '已处理'
  returnDifferenceStatus?: '待处理' | '处理中' | '已处理'
  objectionStatus?: string
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeText(value?: string): string {
  return String(value || '').trim()
}

function shouldIncludeFactoryInSnapshots(
  factoryId: string | undefined,
  options: ProgressStatisticsBuildOptions = {},
): boolean {
  if (!factoryId || options.includeTestFactories) return true
  return !getFactoryMasterRecordById(factoryId)?.isTestFactory
}

function shouldIncludeOrderInSnapshots(
  order: ProductionOrder,
  options: ProgressStatisticsBuildOptions = {},
): boolean {
  return shouldIncludeFactoryInSnapshots(order.mainFactoryId, options)
}

let cuttingSpecialCraftProjectionBindingsCache: CuttingSpecialCraftProjectionBinding[] | null = null
let cuttingSpecialCraftReturnStatusCache: Map<string, CuttingSpecialCraftReturnStatusSummary> | null = null
const handoverProgressSnapshotCache = new Map<string, HandoverProgressSnapshot>()
const progressBlockingReasonsCache = new Map<string, ProgressBlockingReason[]>()
const productionProgressSnapshotCache = new Map<string, ProductionProgressSnapshot>()
const cuttingProgressSnapshotCache = new Map<string, CuttingProgressSnapshot>()

function getOpenDifferenceStatus(status?: string): '待处理' | '处理中' | undefined {
  return status === '待处理' || status === '处理中' ? status : undefined
}

function buildCuttingSpecialCraftProjectionBindings(): CuttingSpecialCraftProjectionBinding[] {
  if (cuttingSpecialCraftProjectionBindingsCache) return cuttingSpecialCraftProjectionBindingsCache

  const taskOrders = listSpecialCraftTaskOrders()
  const taskOrdersByProductionOrderId = new Map<string, typeof taskOrders>()
  taskOrders.forEach((taskOrder) => {
    const list = taskOrdersByProductionOrderId.get(taskOrder.productionOrderId) || []
    list.push(taskOrder)
    taskOrdersByProductionOrderId.set(taskOrder.productionOrderId, list)
  })
  const workOrderLineByDemandLineId = new Map(
    listSpecialCraftTaskWorkOrderLines().map((line) => [line.demandLineId, line] as const),
  )
  const operationById = new Map<string, NonNullable<ReturnType<typeof getSpecialCraftOperationById>>>()
  const getOperation = (operationId: string) => {
    if (!operationById.has(operationId)) {
      const operation = getSpecialCraftOperationById(operationId)
      if (operation) operationById.set(operationId, operation)
    }
    return operationById.get(operationId)
  }
  const generatedTickets = productionOrders.flatMap((order) =>
    listSpreadingResultGeneratedFeiTicketsByProductionOrderId(order.productionOrderId),
  )
  const ticketByNo = new Map(generatedTickets.map((ticket) => [ticket.feiTicketNo, ticket] as const))
  const bindings: CuttingSpecialCraftProjectionBinding[] = []
  const occupiedKeys = new Set<string>()

  generatedTickets.forEach((ticket) => {
    const secondaryCrafts = ticket.secondaryCrafts.map(normalizeText)
    const secondaryCraftSet = new Set(secondaryCrafts)
    if (!secondaryCraftSet.size) return
    const ticketPartName = normalizeText(ticket.partName)
    const ticketColor = normalizeText(ticket.skuColor)

    ;(taskOrdersByProductionOrderId.get(ticket.productionOrderId) || []).forEach((taskOrder) => {
      if (normalizeText(taskOrder.partName) && normalizeText(taskOrder.partName) !== ticketPartName) return
      if (normalizeText(taskOrder.fabricColor) && normalizeText(taskOrder.fabricColor) !== ticketColor) return

      ;(taskOrder.demandLines || []).forEach((line) => {
        if (normalizeText(line.sizeCode) !== normalizeText(ticket.skuSize)) return
        const operation = getOperation(line.operationId)
        if (!operation || !getSpecialCraftFlowRule(line.targetObject).requiresFeiTicketScan) return
        if (!secondaryCraftSet.has(normalizeText(operation.operationName))) return

        const occupiedKey = `${ticket.feiTicketNo}__${operation.operationId}`
        if (occupiedKeys.has(occupiedKey)) return
        occupiedKeys.add(occupiedKey)
        const workOrderLine = workOrderLineByDemandLineId.get(line.demandLineId)
        const sequenceIndex = Math.max(secondaryCrafts.indexOf(normalizeText(operation.operationName)), 0)
        bindings.push({
          bindingId: `SCB-${taskOrder.taskOrderId}-${line.demandLineId}-${ticket.feiTicketNo}-${operation.operationId}`,
          productionOrderId: taskOrder.productionOrderId,
          productionOrderNo: taskOrder.productionOrderNo,
          taskOrderId: taskOrder.taskOrderId,
          taskOrderNo: taskOrder.taskOrderNo,
          demandLineId: line.demandLineId,
          workOrderId: workOrderLine?.workOrderId || taskOrder.workOrderIds?.[0] || '',
          operationId: operation.operationId,
          operationName: operation.operationName,
          targetFactoryId: taskOrder.assignedFactoryId || taskOrder.suggestedFactoryId || taskOrder.factoryId,
          targetFactoryName: taskOrder.assignedFactoryName || taskOrder.suggestedFactoryName || taskOrder.factoryName,
          feiTicketNo: ticket.feiTicketNo,
          qty: ticket.qty,
          currentQty: ticket.qty,
          cumulativeScrapQty: 0,
          cumulativeDamageQty: 0,
          sequenceIndex,
          specialCraftFlowStatus: sequenceIndex === 0 ? '待发料' : '待确认顺序',
        })
      })
    })
  })

  taskOrders.forEach((taskOrder) => {
    ;(taskOrder.demandLines || []).forEach((line) => {
      const operation = getOperation(line.operationId)
      if (!operation || !getSpecialCraftFlowRule(line.targetObject).requiresFeiTicketScan) return
      ;(line.feiTicketNos || []).forEach((feiTicketNo) => {
        const occupiedKey = `${feiTicketNo}__${operation.operationId}`
        if (occupiedKeys.has(occupiedKey)) return
        const generatedTicket = ticketByNo.get(feiTicketNo)
        const workOrderLine = workOrderLineByDemandLineId.get(line.demandLineId)
        const secondaryCrafts = generatedTicket?.secondaryCrafts.map(normalizeText) || []
        const sequenceIndex = Math.max(secondaryCrafts.indexOf(normalizeText(operation.operationName)), 0)
        occupiedKeys.add(occupiedKey)
        bindings.push({
          bindingId: `SCB-${taskOrder.taskOrderId}-${line.demandLineId}-${feiTicketNo}-${operation.operationId}`,
          productionOrderId: taskOrder.productionOrderId,
          productionOrderNo: taskOrder.productionOrderNo,
          taskOrderId: taskOrder.taskOrderId,
          taskOrderNo: taskOrder.taskOrderNo,
          demandLineId: line.demandLineId,
          workOrderId: workOrderLine?.workOrderId || taskOrder.workOrderIds?.[0] || '',
          operationId: operation.operationId,
          operationName: operation.operationName,
          targetFactoryId: taskOrder.assignedFactoryId || taskOrder.suggestedFactoryId || taskOrder.factoryId,
          targetFactoryName: taskOrder.assignedFactoryName || taskOrder.suggestedFactoryName || taskOrder.factoryName,
          feiTicketNo,
          qty: generatedTicket?.qty || line.planPieceQty,
          currentQty: generatedTicket?.qty || line.planPieceQty,
          cumulativeScrapQty: 0,
          cumulativeDamageQty: 0,
          sequenceIndex,
          specialCraftFlowStatus: sequenceIndex === 0 ? '待发料' : '待确认顺序',
        })
      })
    })
  })

  seedCuttingSpecialCraftProjectionBindings(bindings)
  cuttingSpecialCraftProjectionBindingsCache = bindings
  return cuttingSpecialCraftProjectionBindingsCache
}

function seedCuttingSpecialCraftProjectionBindings(bindings: CuttingSpecialCraftProjectionBinding[]): void {
  const firstStageBindings = bindings.filter((binding) => binding.sequenceIndex <= 0)
  const remainingBindings = [...firstStageBindings]
  const takeBinding = (predicate?: (binding: CuttingSpecialCraftProjectionBinding) => boolean): CuttingSpecialCraftProjectionBinding | undefined => {
    const matchIndex = predicate ? remainingBindings.findIndex(predicate) : 0
    if (matchIndex < 0) return undefined
    const [selected] = remainingBindings.splice(matchIndex, 1)
    return selected
  }
  const patchBinding = (
    binding: CuttingSpecialCraftProjectionBinding | undefined,
    patch: Partial<CuttingSpecialCraftProjectionBinding>,
  ): void => {
    if (binding) Object.assign(binding, patch)
  }

  void takeBinding()
  patchBinding(takeBinding(), { specialCraftFlowStatus: '已发料' })
  const receivedBinding = takeBinding()
  patchBinding(receivedBinding, {
    specialCraftFlowStatus: '已接收',
    currentQty: receivedBinding?.qty || 0,
  })
  const waitReturnBinding = takeBinding()
  patchBinding(waitReturnBinding, {
    specialCraftFlowStatus: '待回仓',
    currentQty: waitReturnBinding?.qty || 0,
  })
  const returnedBinding = takeBinding((binding) => binding.qty >= 2) || takeBinding()
  patchBinding(returnedBinding, {
    specialCraftFlowStatus: '已回仓',
    currentQty: returnedBinding?.qty || 0,
  })
  const diffBinding = takeBinding((binding) => binding.qty >= 2) || takeBinding()
  patchBinding(diffBinding, {
    specialCraftFlowStatus: '差异',
    returnDifferenceStatus: '处理中',
    currentQty: Math.max((diffBinding?.qty || 0) - 1, 0),
  })
  const objectionBinding = takeBinding((binding) => binding.qty >= 2) || takeBinding()
  patchBinding(objectionBinding, {
    specialCraftFlowStatus: '异议中',
    returnDifferenceStatus: '处理中',
    objectionStatus: '异议中',
    currentQty: Math.max((objectionBinding?.qty || 0) - 1, 0),
  })
}

function listCuttingSpecialCraftFeiTicketBindingsForProjection(): CuttingSpecialCraftProjectionBinding[] {
  return buildCuttingSpecialCraftProjectionBindings()
}

let cuttingSpecialCraftProjectionBindingsByProductionOrderCache: Map<string, CuttingSpecialCraftProjectionBinding[]> | null = null
let specialCraftTaskWorkOrderLinesCache: ReturnType<typeof listSpecialCraftTaskWorkOrderLines> | null = null

function getCuttingSpecialCraftProjectionBindingsByProductionOrder(productionOrderId: string): CuttingSpecialCraftProjectionBinding[] {
  if (!cuttingSpecialCraftProjectionBindingsByProductionOrderCache) {
    cuttingSpecialCraftProjectionBindingsByProductionOrderCache = new Map()
    listCuttingSpecialCraftFeiTicketBindingsForProjection().forEach((binding) => {
      const list = cuttingSpecialCraftProjectionBindingsByProductionOrderCache!.get(binding.productionOrderId) || []
      list.push(binding)
      cuttingSpecialCraftProjectionBindingsByProductionOrderCache!.set(binding.productionOrderId, list)
    })
  }
  return cuttingSpecialCraftProjectionBindingsByProductionOrderCache!.get(productionOrderId) || []
}

function getSpecialCraftTaskWorkOrderLinesCached(): ReturnType<typeof listSpecialCraftTaskWorkOrderLines> {
  if (!specialCraftTaskWorkOrderLinesCache) {
    specialCraftTaskWorkOrderLinesCache = listSpecialCraftTaskWorkOrderLines()
  }
  return specialCraftTaskWorkOrderLinesCache
}

function buildCuttingSpecialCraftReturnStatusFromBindings(
  productionOrderId: string,
  orderBindings: CuttingSpecialCraftProjectionBinding[],
): CuttingSpecialCraftReturnStatusSummary {
  const productionOrderNo = orderBindings[0]?.productionOrderNo || productionOrderId
  const lastByFeiTicket = new Map<string, CuttingSpecialCraftProjectionBinding>()
  orderBindings.forEach((binding) => {
    const existing = lastByFeiTicket.get(binding.feiTicketNo)
    if (!existing || binding.sequenceIndex > existing.sequenceIndex) {
      lastByFeiTicket.set(binding.feiTicketNo, binding)
    }
  })
  return {
    productionOrderNo,
    totalNeedSpecialCraftFeiTickets: orderBindings.length,
    waitDispatchCount: orderBindings.filter((binding) => binding.specialCraftFlowStatus === '待发料' || binding.specialCraftFlowStatus === '待确认顺序').length,
    dispatchedCount: orderBindings.filter((binding) => binding.specialCraftFlowStatus === '已发料').length,
    receivedBySpecialFactoryCount: orderBindings.filter((binding) => binding.specialCraftFlowStatus === '已接收').length,
    completedCount: orderBindings.filter((binding) => binding.specialCraftFlowStatus === '待回仓').length,
    waitReturnCount: orderBindings.filter((binding) => binding.specialCraftFlowStatus === '待回仓').length,
    returnedCount: orderBindings.filter((binding) => binding.specialCraftFlowStatus === '已回仓').length,
    differenceCount: orderBindings.filter((binding) => getOpenDifferenceStatus(binding.receiveDifferenceStatus) || getOpenDifferenceStatus(binding.returnDifferenceStatus)).length,
    objectionCount: orderBindings.filter((binding) => binding.objectionStatus === '异议中').length,
    allReturned:
      lastByFeiTicket.size > 0
      && [...lastByFeiTicket.values()].every((binding) => binding.specialCraftFlowStatus === '已回仓' && binding.currentQty > 0),
  }
}

export function getCuttingSpecialCraftReturnStatusByProductionOrders(
  productionOrderIds: string[],
): Map<string, CuttingSpecialCraftReturnStatusSummary> {
  if (!cuttingSpecialCraftReturnStatusCache) {
    const groups = new Map<string, CuttingSpecialCraftProjectionBinding[]>()
    listCuttingSpecialCraftFeiTicketBindingsForProjection().forEach((binding) => {
      const list = groups.get(binding.productionOrderId) || []
      list.push(binding)
      groups.set(binding.productionOrderId, list)
    })
    cuttingSpecialCraftReturnStatusCache = new Map()
    productionOrders.forEach((order) => {
      const status = buildCuttingSpecialCraftReturnStatusFromBindings(order.productionOrderId, groups.get(order.productionOrderId) || [])
      cuttingSpecialCraftReturnStatusCache!.set(order.productionOrderId, {
        ...status,
        productionOrderNo: status.productionOrderNo === order.productionOrderId ? order.productionOrderNo : status.productionOrderNo,
      })
    })
    groups.forEach((bindings, productionOrderId) => {
      if (cuttingSpecialCraftReturnStatusCache!.has(productionOrderId)) return
      cuttingSpecialCraftReturnStatusCache!.set(productionOrderId, buildCuttingSpecialCraftReturnStatusFromBindings(productionOrderId, bindings))
    })
  }

  const result = new Map<string, CuttingSpecialCraftReturnStatusSummary>()
  productionOrderIds.forEach((productionOrderId) => {
    result.set(
      productionOrderId,
      cuttingSpecialCraftReturnStatusCache!.get(productionOrderId)
        || buildCuttingSpecialCraftReturnStatusFromBindings(productionOrderId, []),
    )
  })
  return result
}

export function getCuttingSpecialCraftReturnStatusByProductionOrder(
  productionOrderId: string,
): CuttingSpecialCraftReturnStatusSummary {
  return getCuttingSpecialCraftReturnStatusByProductionOrders([productionOrderId]).get(productionOrderId)!
}

export function compareProductionProgressByDefaultDueDate<
  T extends { dueDate?: string; urgencyLevel?: string; productionOrderNo?: string },
>(left: T, right: T): number {
  const leftDueDate = left.dueDate || ''
  const rightDueDate = right.dueDate || ''
  if (leftDueDate && rightDueDate && leftDueDate !== rightDueDate) {
    return leftDueDate.localeCompare(rightDueDate)
  }
  if (leftDueDate && !rightDueDate) return -1
  if (!leftDueDate && rightDueDate) return 1
  const urgencyCompare =
    (PROGRESS_URGENCY_SORT_WEIGHT[right.urgencyLevel || ''] ?? -1)
    - (PROGRESS_URGENCY_SORT_WEIGHT[left.urgencyLevel || ''] ?? -1)
  if (urgencyCompare !== 0) return urgencyCompare
  return String(left.productionOrderNo || '').localeCompare(String(right.productionOrderNo || ''), 'zh-CN')
}

export function sortProductionProgressByDefaultDueDate<
  T extends { dueDate?: string; urgencyLevel?: string; productionOrderNo?: string },
>(rows: T[]): T[] {
  return [...rows].sort(compareProductionProgressByDefaultDueDate)
}

function totalOrderQty(order: ProductionOrder): number {
  return sum(order.demandSnapshot.skuLines.map((line) => line.qty))
}

function getStyleNo(order: ProductionOrder): string {
  return order.demandSnapshot.spuCode || order.legacyOrderNo || order.productionOrderNo
}

function getStyleName(order: ProductionOrder): string {
  return order.demandSnapshot.spuName || order.legacyOrderNo || order.productionOrderNo
}

function mapSupportedTargetObjectLabel(value: string): string {
  if (value === 'CUT_PIECE') return '已裁部位'
  if (value === 'FULL_FABRIC') return '完整面料'
  return value
}

function getTechPackSpecialCraftSourceSummary(order: ProductionOrder): {
  selectedTargetObjectSummary: string[]
  supportedTargetObjectSummary: string[]
  bundleLengthCmValues: number[]
  bundleWidthCmValues: number[]
} {
  const cutPieceCrafts = (order.techPackSnapshot?.cutPieceParts ?? []).flatMap((part) => part.specialCrafts ?? [])
  const patternPieceCrafts = (order.techPackSnapshot?.patternFiles ?? [])
    .flatMap((file) => file.pieceRows ?? [])
    .flatMap((row) => row.specialCrafts ?? [])
  const allCrafts = [...cutPieceCrafts, ...patternPieceCrafts]
  const selectedTargetObjectSummary = unique(
    allCrafts
      .map((craft) => craft.selectedTargetObject)
      .filter((value): value is string => Boolean(value)),
  )
  const supportedTargetObjectSummary = unique(
    allCrafts.flatMap((craft) => [
      ...((craft.supportedTargetObjectLabels ?? []).filter(Boolean)),
      ...((craft.supportedTargetObjects ?? []).map(mapSupportedTargetObjectLabel).filter(Boolean)),
    ]),
  )
  const bundleLengthCmValues = unique(
    [
      ...(order.techPackSnapshot?.cutPieceParts ?? []).map((part) => `${part.bundleLengthCm ?? ''}`),
      ...(order.techPackSnapshot?.patternFiles ?? [])
        .flatMap((file) => file.pieceRows ?? [])
        .map((row) => `${(row as { bundleLengthCm?: number }).bundleLengthCm ?? ''}`),
    ].filter(Boolean),
  )
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
  const bundleWidthCmValues = unique(
    [
      ...(order.techPackSnapshot?.cutPieceParts ?? []).map((part) => `${part.bundleWidthCm ?? ''}`),
      ...(order.techPackSnapshot?.patternFiles ?? [])
        .flatMap((file) => file.pieceRows ?? [])
        .map((row) => `${(row as { bundleWidthCm?: number }).bundleWidthCm ?? ''}`),
    ].filter(Boolean),
  )
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

  return {
    selectedTargetObjectSummary,
    supportedTargetObjectSummary,
    bundleLengthCmValues,
    bundleWidthCmValues,
  }
}

function getDueDate(order: ProductionOrder): string {
  return order.demandSnapshot.requiredDeliveryDate || ''
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00`).getTime()
  const to = new Date(`${toDate}T00:00:00`).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 999
  return Math.ceil((to - from) / 86_400_000)
}

function resolveUrgencyLevel(order: ProductionOrder): string {
  const dueDate = getDueDate(order)
  if (!dueDate) return '待人工核对：缺少交期'
  const days = daysBetween(DEMO_TODAY, dueDate)
  if (days <= 8) return '十万火急'
  if (days <= 10) return '紧急 A'
  if (days <= 13) return '紧急 B'
  return totalOrderQty(order) >= 1000 ? 'C' : 'D'
}

function getMaterialPrepRows(order: ProductionOrder) {
  return cuttingMaterialPrepGroups.flatMap((group) =>
    group.productionOrderNo === order.productionOrderNo ? group.materialLines : [],
  )
}

function resolveMaterialPrepStatus(order: ProductionOrder): ProductionProgressSnapshot['materialPrepStatus'] {
  const lines = getMaterialPrepRows(order)
  if (!lines.length) return order.techPackSnapshot ? '有配料数量' : '无配料数量'
  if (lines.every((line) => line.configStatus === 'CONFIGURED')) return '有配料数量'
  if (lines.some((line) => line.configuredLength > 0 || line.configuredRollCount > 0)) return '配料数量不足'
  return '无配料数量'
}

function resolveCuttingPickupStatus(order: ProductionOrder): ProductionProgressSnapshot['cuttingPickupStatus'] {
  const lines = getMaterialPrepRows(order)
  if (lines.some((line) => line.receiveStatus === 'RECHECK' || line.discrepancyStatus !== 'NONE')) return '差异待处理'
  if (!lines.length) return order.status === 'EXECUTING' || order.status === 'COMPLETED' ? '有领料记录' : '无领料记录'
  if (lines.some((line) => line.receivedLength > 0 || line.receivedRollCount > 0)) return '有领料记录'
  return '无领料记录'
}

function resolveFeiTicketStatus(order: ProductionOrder): ProductionProgressSnapshot['feiTicketStatus'] {
  const tickets = listSpreadingResultGeneratedFeiTicketsByProductionOrderId(order.productionOrderId)
  if (tickets.length === 0) return '未生成'
  const expectedLines = getMaterialPrepRows(order).length
  if (expectedLines > 0 && tickets.length < expectedLines) return '部分生成'
  return '已生成'
}

function resolveCuttingStatus(order: ProductionOrder): ProductionProgressSnapshot['cuttingStatus'] {
  const tickets = listSpreadingResultGeneratedFeiTicketsByProductionOrderId(order.productionOrderId)
  if (tickets.length > 0) return '已裁剪'
  if (order.status === 'EXECUTING') return '裁剪中'
  return '待裁剪'
}

function resolveCuttingWaitHandoverStatus(order: ProductionOrder): ProductionProgressSnapshot['cuttingWaitHandoverStatus'] {
  const ticketCount = listSpreadingResultGeneratedFeiTicketsByProductionOrderId(order.productionOrderId).length
  const waitHandoverItems = listFactoryWaitHandoverStockItems().filter((item) => item.productionOrderId === order.productionOrderId)
  if (waitHandoverItems.length === 0) return '未入仓'
  if (ticketCount > 0 && waitHandoverItems.length < ticketCount) return '部分入仓'
  return '已入裁床厂待交出仓'
}

function resolveSpecialCraftStatus(order: ProductionOrder): ProductionProgressSnapshot['specialCraftStatus'] {
  const tasks = getSpecialCraftTasksByProductionOrder(order.productionOrderId)
  if (!tasks.length) return '无特殊工艺'
  const returnStatus = getCuttingSpecialCraftReturnStatusByProductionOrder(order.productionOrderId)
  if (returnStatus.totalNeedSpecialCraftFeiTickets > 0 && returnStatus.allReturned) return '已回仓'
  if (returnStatus.objectionCount > 0) return '异议中'
  if (returnStatus.differenceCount > 0) return '差异'
  if (returnStatus.waitReturnCount > 0) return '待回仓'
  if (returnStatus.receivedBySpecialFactoryCount > 0 || tasks.some((task) => task.status === '加工中')) return '加工中'
  return '待交出'
}

function resolveSpecialCraftReturnStatus(order: ProductionOrder): ProductionProgressSnapshot['specialCraftReturnStatus'] {
  const status = getCuttingSpecialCraftReturnStatusByProductionOrder(order.productionOrderId)
  if (status.totalNeedSpecialCraftFeiTickets === 0) return '不需要回仓'
  if (status.allReturned) return '已回仓'
  if (status.objectionCount > 0) return '异议中'
  if (status.differenceCount > 0) return '差异'
  if (status.returnedCount > 0) return '部分回仓'
  return '未回仓'
}

export function buildSewingDispatchProgressSnapshot(order: ProductionOrder): SewingDispatchProgressSnapshot {
  const cached = sewingDispatchProgressSnapshotCache.get(order.productionOrderId)
  if (cached) return cached

  const totalProductionQty = totalOrderQty(order)
  const tickets = listSpreadingResultGeneratedFeiTicketsByProductionOrderId(order.productionOrderId)
  const ticketQty = sum(tickets.map((ticket) => ticket.garmentQty || ticket.qty || 0))
  const specialReturn = getCuttingSpecialCraftReturnStatusByProductionOrder(order.productionOrderId)
  const hasDifference = specialReturn.differenceCount > 0
  const hasObjection = specialReturn.objectionCount > 0
  const orderIndex = Math.max(productionOrders.findIndex((item) => item.productionOrderId === order.productionOrderId), 0)
  const dispatchRatio =
    tickets.length === 0
      ? 0
      : order.status === 'COMPLETED'
        ? 1
        : order.status === 'EXECUTING'
          ? [0.35, 0.55, 0.72][orderIndex % 3]
          : 0
  const cumulativeDispatchedGarmentQty = Math.min(
    totalProductionQty,
    Math.max(0, Math.round((ticketQty || totalProductionQty) * dispatchRatio)),
  )
  const remainingGarmentQty = Math.max(totalProductionQty - cumulativeDispatchedGarmentQty, 0)
  const dispatchBatchCount = cumulativeDispatchedGarmentQty > 0
    ? Math.max(1, Math.min(3, Math.ceil(cumulativeDispatchedGarmentQty / Math.max(Math.ceil(totalProductionQty / 3), 1))))
    : 0
  const transferBagCount = cumulativeDispatchedGarmentQty > 0
    ? Math.max(dispatchBatchCount, Math.ceil(Math.max(tickets.length, dispatchBatchCount) / 2))
    : 0
  const dispatchedTransferBagCount = transferBagCount
  const packedTransferBagCount = transferBagCount
  const writtenBackTransferBagCount =
    transferBagCount > 0 && order.status === 'COMPLETED'
      ? transferBagCount
      : Math.floor(transferBagCount * 0.45)
  const partialWritebackTransferBagCount =
    writtenBackTransferBagCount > 0 && writtenBackTransferBagCount < transferBagCount ? 1 : 0
  const differenceTransferBagCount = hasDifference ? 1 : 0
  const objectionTransferBagCount = hasObjection ? 1 : 0
  const receivedTransferBagCount = Math.max(writtenBackTransferBagCount, Math.floor(transferBagCount * 0.6))
  const blockingReasons = [
    hasDifference ? '存在特殊工艺差异' : '',
    hasObjection ? '存在数量异议' : '',
    tickets.length === 0 ? '菲票未生成' : '',
  ].filter(Boolean)

  const snapshot: SewingDispatchProgressSnapshot = {
    snapshotId: `SPD-${order.productionOrderId}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    totalProductionQty,
    cumulativeDispatchedGarmentQty,
    remainingGarmentQty,
    dispatchOrderCount: dispatchBatchCount > 0 ? 1 : 0,
    dispatchBatchCount,
    transferOrderCount: dispatchBatchCount,
    transferBagCount,
    contentItemCount: transferBagCount,
    contentFeiTicketCount: Math.min(tickets.length, transferBagCount * 2),
    contentMaterialLineCount: Math.max(dispatchBatchCount, Math.ceil(tickets.length / 3)),
    mixedTransferBagCount: transferBagCount > 1 ? Math.floor(transferBagCount / 3) : 0,
    packedTransferBagCount,
    receivedTransferBagCount,
    receivedFeiTicketCount: Math.min(tickets.length, Math.max(0, receivedTransferBagCount * 2)),
    scannedReceivedTransferBagCount: receivedTransferBagCount,
    completedTransferBagCount: Math.max(0, transferBagCount - differenceTransferBagCount - objectionTransferBagCount),
    dispatchedTransferBagCount,
    writtenBackTransferBagCount,
    bagWritebackLineCount: writtenBackTransferBagCount,
    feiTicketWritebackLineCount: Math.min(tickets.length, Math.max(0, writtenBackTransferBagCount * 2)),
    partialWrittenBackTransferBagCount: partialWritebackTransferBagCount,
    partialWritebackTransferBagCount,
    differenceTransferBagCount,
    bagDifferenceCount: differenceTransferBagCount,
    feiTicketDifferenceCount: differenceTransferBagCount ? 1 : 0,
    objectionTransferBagCount,
    canCreateNextBatch: !hasDifference && !hasObjection && tickets.length > 0 && remainingGarmentQty > 0,
    blockingReasons,
    updatedAt: DEMO_TODAY,
  }

  sewingDispatchProgressSnapshotCache.set(order.productionOrderId, snapshot)
  return snapshot
}

export function getCuttingSewingDispatchProgressByProductionOrder(
  productionOrderId: string,
): SewingDispatchProgressSnapshot {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  if (order) return buildSewingDispatchProgressSnapshot(order)
  return {
    snapshotId: `SPD-${productionOrderId}`,
    productionOrderId,
    productionOrderNo: '',
    totalProductionQty: 0,
    cumulativeDispatchedGarmentQty: 0,
    remainingGarmentQty: 0,
    dispatchOrderCount: 0,
    dispatchBatchCount: 0,
    transferOrderCount: 0,
    transferBagCount: 0,
    contentItemCount: 0,
    contentFeiTicketCount: 0,
    contentMaterialLineCount: 0,
    mixedTransferBagCount: 0,
    packedTransferBagCount: 0,
    receivedTransferBagCount: 0,
    receivedFeiTicketCount: 0,
    scannedReceivedTransferBagCount: 0,
    completedTransferBagCount: 0,
    dispatchedTransferBagCount: 0,
    writtenBackTransferBagCount: 0,
    bagWritebackLineCount: 0,
    feiTicketWritebackLineCount: 0,
    partialWrittenBackTransferBagCount: 0,
    partialWritebackTransferBagCount: 0,
    differenceTransferBagCount: 0,
    bagDifferenceCount: 0,
    feiTicketDifferenceCount: 0,
    objectionTransferBagCount: 0,
    canCreateNextBatch: false,
    blockingReasons: ['生产单不存在'],
    updatedAt: DEMO_TODAY,
  }
}

function resolveSewingDispatchStatus(snapshot: SewingDispatchProgressSnapshot): ProductionProgressSnapshot['sewingDispatchStatus'] {
  if (snapshot.differenceTransferBagCount > 0) return '差异'
  if (snapshot.objectionTransferBagCount > 0) return '异议中'
  if (snapshot.cumulativeDispatchedGarmentQty <= 0) return '未交出'
  if (snapshot.remainingGarmentQty > 0) return '部分交出'
  return '已全部交出'
}

function resolveSewingReceiveStatus(snapshot: SewingDispatchProgressSnapshot): ProductionProgressSnapshot['sewingReceiveStatus'] {
  if (snapshot.differenceTransferBagCount > 0) return '差异'
  if (snapshot.objectionTransferBagCount > 0) return '异议中'
  if (snapshot.writtenBackTransferBagCount <= 0) return '未回写'
  if (snapshot.writtenBackTransferBagCount < snapshot.dispatchedTransferBagCount) return '部分回写'
  return '已回写'
}

export function buildHandoverProgressSnapshot(order: ProductionOrder): HandoverProgressSnapshot {
  const cached = handoverProgressSnapshotCache.get(order.productionOrderId)
  if (cached) return cached

  const heads = listPdaHandoverHeads().filter((head) => head.productionOrderNo === order.productionOrderNo)
  const records = heads.flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
  const writebacks = listReceiverWritebacks().filter((item) => heads.some((head) => head.handoverId === item.handoverOrderId || head.handoverOrderId === item.handoverOrderId))
  const objections = listQuantityObjections().filter((item) => item.productionOrderId === order.productionOrderId || heads.some((head) => head.handoverOrderId === item.handoverOrderId))
  const factoryId = heads[0]?.factoryId || order.mainFactoryId
  const factoryName = heads[0]?.sourceFactoryName || order.mainFactorySnapshot.name
  const snapshot = {
    snapshotId: `HPS-${order.productionOrderId}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    factoryId,
    factoryName,
    handoverOrderCount: heads.length,
    handoverRecordCount: records.length,
    submittedQty: sum(records.map((record) => record.submittedQty || record.plannedQty || 0)),
    receiverWrittenQty: sum(records.map((record) => record.receiverWrittenQty || record.warehouseWrittenQty || 0)) + sum(writebacks.map((item) => item.writtenQty)),
    differenceQty: sum(records.map((record) => Math.abs(record.diffQty || 0))) + sum(writebacks.map((item) => Math.abs(item.diffQty || 0))),
    pickupCompletedOrderCount: heads.filter((head) => head.headType === 'PICKUP' && head.completionStatus === 'COMPLETED').length,
    handoutCompletedOrderCount: heads.filter((head) => head.headType === 'HANDOUT' && head.completionStatus === 'COMPLETED').length,
    receiverClosedCount: heads.filter((head) => head.headType === 'HANDOUT' && Boolean(head.receiverClosedAt)).length,
    waitWritebackCount: records.filter((record) => typeof record.receiverWrittenQty !== 'number' && typeof record.warehouseWrittenQty !== 'number').length,
    writtenBackCount: records.filter((record) => typeof record.receiverWrittenQty === 'number' || typeof record.warehouseWrittenQty === 'number').length,
    differenceCount: records.filter((record) => (record.diffQty || 0) !== 0).length + writebacks.filter((item) => item.diffQty !== 0).length,
    objectionCount: objections.length,
    updatedAt: DEMO_TODAY,
  }

  handoverProgressSnapshotCache.set(order.productionOrderId, snapshot)
  return snapshot
}

function resolveHandoverStatus(snapshot: HandoverProgressSnapshot): ProductionProgressSnapshot['handoverStatus'] {
  if (snapshot.handoverRecordCount === 0) return '无交接'
  if (snapshot.objectionCount > 0) return '异议中'
  if (snapshot.differenceCount > 0) return '差异'
  if (snapshot.waitWritebackCount > 0) return '待回写'
  return '已回写'
}

function makeBlockingReason(
  order: ProductionOrder,
  index: number,
  sourceModule: ProgressBlockingReason['sourceModule'],
  sourceRecordNo: string,
  blockingLabel: string,
  nextActionLabel: string,
  relatedRoute: string,
  severity: ProgressBlockingReason['severity'] = '普通',
): ProgressBlockingReason {
  return {
    reasonId: `PBR-${order.productionOrderId}-${index}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    sourceModule,
    sourceRecordNo,
    blockingType: blockingLabel,
    blockingLabel,
    severity,
    canResolveInCurrentPrompt: false,
    nextActionLabel,
    relatedRoute,
    createdAt: DEMO_TODAY,
  }
}

export function buildProgressBlockingReasons(order: ProductionOrder): ProgressBlockingReason[] {
  const cached = progressBlockingReasonsCache.get(order.productionOrderId)
  if (cached) return cached

  const reasons: Array<Omit<ProgressBlockingReason, 'reasonId'>> = []
  const materialPrepStatus = resolveMaterialPrepStatus(order)
  const pickupStatus = resolveCuttingPickupStatus(order)
  const cuttingStatus = resolveCuttingStatus(order)
  const feiStatus = resolveFeiTicketStatus(order)
  const waitHandoverStatus = resolveCuttingWaitHandoverStatus(order)
  const specialReturnStatus = resolveSpecialCraftReturnStatus(order)
  const sewingSnapshot = buildSewingDispatchProgressSnapshot(order)
  const handoverSnapshot = buildHandoverProgressSnapshot(order)

  const add = (
    sourceModule: ProgressBlockingReason['sourceModule'],
    sourceRecordNo: string,
    blockingLabel: string,
    nextActionLabel: string,
    relatedRoute: string,
    severity: ProgressBlockingReason['severity'] = '普通',
  ) => {
    reasons.push({
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      sourceModule,
      sourceRecordNo,
      blockingType: blockingLabel,
      blockingLabel,
      severity,
      canResolveInCurrentPrompt: false,
      nextActionLabel,
      relatedRoute,
      createdAt: DEMO_TODAY,
    })
  }

  if (materialPrepStatus === '无配料数量') add('待加工入仓', order.productionOrderNo, '面料未完成中转仓配料', '查看待加工仓', '/fcs/craft/cutting/warehouse-management/wait-process', '加急')
  if (materialPrepStatus === '配料数量不足') add('待加工入仓', order.productionOrderNo, '面料已完成部分中转仓配料', '查看待加工仓', '/fcs/craft/cutting/warehouse-management/wait-process', '普通')
  if (pickupStatus === '无领料记录') add('待加工入仓', order.productionOrderNo, '面料未形成裁床领料记录', '查看待加工仓', '/fcs/craft/cutting/warehouse-management/wait-process')
  if (pickupStatus === '差异待处理') add('领料', order.productionOrderNo, '领料差异待处理', '处理差异', '/fcs/progress/handover', '紧急')
  if (cuttingStatus !== '已裁剪') add('裁床', order.productionOrderNo, cuttingStatus === '裁剪中' ? '裁剪未完成' : '唛架未完成', '裁剪', '/fcs/craft/cutting/production-progress')
  if (feiStatus !== '已生成') add('菲票', order.productionOrderNo, '菲票未生成', '打印菲票', '/fcs/craft/cutting/fei-tickets')
  if (waitHandoverStatus !== '已入裁床厂待交出仓') add('裁床', order.productionOrderNo, '裁片未入裁床厂待交出仓', '裁片入仓', '/fcs/craft/cutting/production-progress')
  if (specialReturnStatus === '差异') add('特殊工艺', order.productionOrderNo, '特殊工艺差异', '处理差异', '/fcs/craft/cutting/warehouse-management/wait-handover?tab=special-craft-return', '紧急')
  if (specialReturnStatus === '异议中') add('特殊工艺', order.productionOrderNo, '特殊工艺异议中', '处理异议', '/fcs/craft/cutting/warehouse-management/wait-handover?tab=special-craft-return', '紧急')
  sewingSnapshot.blockingReasons.forEach((reason) => {
    add('交出单', order.productionOrderNo, reason || '本次交出后存在缺口', '新增交出记录', '/fcs/craft/cutting/warehouse-management/wait-handover?tab=handoverOrders', '加急')
  })
  if (handoverSnapshot.differenceCount > 0) add('交接', order.productionOrderNo, '交接差异', '处理差异', '/fcs/progress/handover', '紧急')
  if (handoverSnapshot.objectionCount > 0) add('交接', order.productionOrderNo, '数量异议中', '处理异议', '/fcs/progress/handover', '紧急')

  const result = reasons.map((reason, index) => makeBlockingReason(
    order,
    index + 1,
    reason.sourceModule,
    reason.sourceRecordNo,
    reason.blockingLabel,
    reason.nextActionLabel,
    reason.relatedRoute,
    reason.severity,
  ))
  progressBlockingReasonsCache.set(order.productionOrderId, result)
  return result
}

function resolveNextAction(snapshot: Omit<ProductionProgressSnapshot, 'nextActionLabel'> & { blockingReasons: ProgressBlockingReason[] }): string {
  if (snapshot.blockingReasons.length > 0) return snapshot.blockingReasons[0].nextActionLabel
  if (snapshot.sewingDispatchStatus === '未交出' || snapshot.sewingDispatchStatus === '部分交出') return '新增交出记录'
  if (snapshot.sewingReceiveStatus !== '已回写') return '等待车缝回写'
  return '已完成当前节点'
}

export function buildProductionProgressSnapshot(order: ProductionOrder): ProductionProgressSnapshot {
  const cached = productionProgressSnapshotCache.get(order.productionOrderId)
  if (cached) return cached

  const sewingSnapshot = buildSewingDispatchProgressSnapshot(order)
  const handoverSnapshot = buildHandoverProgressSnapshot(order)
  const specialCraftReturnStatus = resolveSpecialCraftReturnStatus(order)
  const blockingReasons = buildProgressBlockingReasons(order)
  const specialCraftTasks = getSpecialCraftTasksByProductionOrder(order.productionOrderId)
  const specialCraftBindings = getCuttingSpecialCraftProjectionBindingsByProductionOrder(order.productionOrderId)
  const specialCraftWorkOrders = listSpecialCraftTaskWorkOrders().filter((workOrder) => workOrder.productionOrderId === order.productionOrderId)
  const techPackSpecialCraftSource = getTechPackSpecialCraftSourceSummary(order)
  const transferBagCombinedWritebackStatus = (() => {
    const recordStatuses = listPdaHandoverHeads()
      .filter((head) => head.productionOrderNo === order.productionOrderNo)
      .flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
      .map((record) => record.combinedWritebackStatus)
      .filter((status): status is string => Boolean(status))
    if (recordStatuses.includes('异议中')) return '异议中'
    if (recordStatuses.includes('差异')) return '差异'
    if (recordStatuses.includes('部分回写')) return '部分回写'
    if (recordStatuses.includes('已回写')) return '已回写'
    if (recordStatuses.includes('待回写')) return '待回写'
    return '无交接'
  })()
  const partialSnapshot = {
    snapshotId: `PPS-${order.productionOrderId}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    styleNo: getStyleNo(order),
    styleName: getStyleName(order),
    totalQty: totalOrderQty(order),
    dueDate: getDueDate(order),
    urgencyLevel: resolveUrgencyLevel(order),
    materialPrepStatus: resolveMaterialPrepStatus(order),
    cuttingPickupStatus: resolveCuttingPickupStatus(order),
    cuttingStatus: resolveCuttingStatus(order),
    feiTicketStatus: resolveFeiTicketStatus(order),
    cuttingWaitHandoverStatus: resolveCuttingWaitHandoverStatus(order),
    specialCraftStatus: resolveSpecialCraftStatus(order),
    specialCraftReturnStatus,
    specialCraftTargetObjectSummary: unique([
      ...specialCraftTasks.map((task) => task.targetObject),
      ...techPackSpecialCraftSource.selectedTargetObjectSummary,
    ]),
    specialCraftWorkOrderCount: specialCraftWorkOrders.length,
    specialCraftCurrentQty: Math.round(sum(specialCraftBindings.map((binding) => binding.currentQty)) * 100) / 100,
    specialCraftScrapQty: Math.round(sum(specialCraftBindings.map((binding) => binding.cumulativeScrapQty)) * 100) / 100,
    specialCraftDamageQty: Math.round(sum(specialCraftBindings.map((binding) => binding.cumulativeDamageQty)) * 100) / 100,
    specialCraftDifferenceWarning: specialCraftBindings.some((binding) =>
      binding.receiveDifferenceStatus === '待处理'
      || binding.receiveDifferenceStatus === '处理中'
      || binding.returnDifferenceStatus === '待处理'
      || binding.returnDifferenceStatus === '处理中',
    ),
    sewingDispatchStatus: resolveSewingDispatchStatus(sewingSnapshot),
    sewingReceiveStatus: resolveSewingReceiveStatus(sewingSnapshot),
    pickupOrderCompleted: handoverSnapshot.pickupCompletedOrderCount > 0,
    handoutOrderCompleted: handoverSnapshot.handoutCompletedOrderCount > 0,
    transferBagCombinedWritebackStatus,
    handoverStatus: resolveHandoverStatus(handoverSnapshot),
    differenceStatus: handoverSnapshot.differenceCount > 0 || sewingSnapshot.differenceTransferBagCount > 0 || specialCraftReturnStatus === '差异' ? '差异' : '无差异',
    objectionStatus: handoverSnapshot.objectionCount > 0 || sewingSnapshot.objectionTransferBagCount > 0 || specialCraftReturnStatus === '异议中' ? '异议中' : '无异议',
    canProceedToSewingDispatch:
      specialCraftReturnStatus !== '差异'
      && specialCraftReturnStatus !== '异议中'
      && sewingSnapshot.canCreateNextBatch,
    blockingReasons,
    updatedAt: DEMO_TODAY,
  } satisfies Omit<ProductionProgressSnapshot, 'nextActionLabel'>

  const snapshot = {
    ...partialSnapshot,
    nextActionLabel: resolveNextAction(partialSnapshot),
  }
  productionProgressSnapshotCache.set(order.productionOrderId, snapshot)
  return snapshot
}

function metric(
  status: string,
  plannedQty: number,
  completedQty: number,
  differenceQty: number,
  abnormalCount: number,
  lastUpdatedAt = DEMO_TODAY,
): CuttingProgressMetric {
  return { status, plannedQty, completedQty, differenceQty, abnormalCount, lastUpdatedAt }
}

export function buildCuttingProgressSnapshot(order: ProductionOrder): CuttingProgressSnapshot {
  const cached = cuttingProgressSnapshotCache.get(order.productionOrderId)
  if (cached) return cached

  const prepRows = getMaterialPrepRows(order)
  const tickets = listSpreadingResultGeneratedFeiTicketsByProductionOrderId(order.productionOrderId)
  const specialReturn = getCuttingSpecialCraftReturnStatusByProductionOrder(order.productionOrderId)
  const sewing = buildSewingDispatchProgressSnapshot(order)
  const handover = buildHandoverProgressSnapshot(order)
  const blockingReasons = buildProgressBlockingReasons(order)
  const specialCraftBindings = getCuttingSpecialCraftProjectionBindingsByProductionOrder(order.productionOrderId)
  const relatedWorkOrderIds = new Set(specialCraftBindings.map((binding) => binding.workOrderId))
  const bundleLines = getSpecialCraftTaskWorkOrderLinesCached().filter((line) =>
    relatedWorkOrderIds.has(line.workOrderId),
  )
  const techPackSpecialCraftSource = getTechPackSpecialCraftSourceSummary(order)
  const cuttingOrderNos = unique(prepRows.map((line) => line.cutPieceOrderNo).concat(tickets.map((ticket) => ticket.cutOrderNo)))
  const snapshot = {
    snapshotId: `CPS-${order.productionOrderId}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    cuttingOrderIds: cuttingOrderNos,
    cuttingOrderNos,
    materialPrepProgress: metric(resolveMaterialPrepStatus(order), sum(prepRows.map((line) => line.demandLength)), sum(prepRows.map((line) => line.configuredLength)), 0, prepRows.filter((line) => line.configStatus !== 'CONFIGURED').length),
    pickupProgress: metric(resolveCuttingPickupStatus(order), sum(prepRows.map((line) => line.demandLength)), sum(prepRows.map((line) => line.receivedLength)), prepRows.filter((line) => line.discrepancyStatus !== 'NONE').length, prepRows.filter((line) => line.discrepancyStatus !== 'NONE').length),
    markerProgress: metric(prepRows.length ? '已生成唛架' : '唛架未完成', prepRows.length, prepRows.length, 0, 0),
    spreadingProgress: metric(tickets.length ? '已铺布' : '铺布未完成', totalOrderQty(order), tickets.reduce((total, ticket) => total + ticket.garmentQty, 0), 0, 0),
    cuttingProgress: metric(resolveCuttingStatus(order), totalOrderQty(order), tickets.reduce((total, ticket) => total + ticket.garmentQty, 0), 0, resolveCuttingStatus(order) === '异常' ? 1 : 0),
    feiTicketProgress: metric(resolveFeiTicketStatus(order), prepRows.length || tickets.length, tickets.length, 0, 0),
    cutPieceWarehouseProgress: metric(resolveCuttingWaitHandoverStatus(order), tickets.length, listFactoryWaitHandoverStockItems().filter((item) => item.productionOrderId === order.productionOrderId).length, 0, 0),
    specialCraftDispatchProgress: metric(specialReturn.waitDispatchCount > 0 ? '待交出' : '已交出', specialReturn.totalNeedSpecialCraftFeiTickets, specialReturn.dispatchedCount, specialReturn.differenceCount, specialReturn.objectionCount),
    specialCraftReturnProgress: metric(resolveSpecialCraftReturnStatus(order), specialReturn.totalNeedSpecialCraftFeiTickets, specialReturn.returnedCount, specialReturn.differenceCount, specialReturn.objectionCount),
    sewingDispatchProgress: metric(resolveSewingDispatchStatus(sewing), sewing.totalProductionQty, sewing.cumulativeDispatchedGarmentQty, sewing.differenceTransferBagCount, sewing.objectionTransferBagCount),
    specialCraftCurrentQty: Math.round(sum(specialCraftBindings.map((binding) => binding.currentQty)) * 100) / 100,
    specialCraftScrapQty: Math.round(sum(specialCraftBindings.map((binding) => binding.cumulativeScrapQty)) * 100) / 100,
    specialCraftDamageQty: Math.round(sum(specialCraftBindings.map((binding) => binding.cumulativeDamageQty)) * 100) / 100,
    specialCraftDifferenceWarning: specialCraftBindings.some((binding) =>
      binding.receiveDifferenceStatus === '待处理'
      || binding.receiveDifferenceStatus === '处理中'
      || binding.returnDifferenceStatus === '待处理'
      || binding.returnDifferenceStatus === '处理中',
    ),
    pickupOrderCompleted: handover.pickupCompletedOrderCount > 0,
    handoutOrderCompleted: handover.handoutCompletedOrderCount > 0,
    transferBagPackStatus:
      sewing.dispatchedTransferBagCount <= 0
        ? '待装袋'
        : sewing.packedTransferBagCount < sewing.transferBagCount
          ? '装袋中'
          : '已装袋',
    transferBagCombinedWritebackStatus:
      sewing.objectionTransferBagCount > 0
        ? '异议中'
        : sewing.bagDifferenceCount > 0 || sewing.feiTicketDifferenceCount > 0
          ? '差异'
          : sewing.partialWritebackTransferBagCount > 0
            ? '部分回写'
            : sewing.writtenBackTransferBagCount > 0
              ? '已回写'
              : '待回写',
    transferBagBagDifferenceCount: sewing.bagDifferenceCount,
    transferBagFeiTicketDifferenceCount: sewing.feiTicketDifferenceCount,
    bundleLengthCmValues: unique([
      ...bundleLines.map((line) => `${line.bundleLengthCm ?? ''}`),
      ...techPackSpecialCraftSource.bundleLengthCmValues.map(String),
    ]).filter(Boolean).map((value) => Number(value)).filter((value) => Number.isFinite(value)),
    bundleWidthCmValues: unique([
      ...bundleLines.map((line) => `${line.bundleWidthCm ?? ''}`),
      ...techPackSpecialCraftSource.bundleWidthCmValues.map(String),
    ]).filter(Boolean).map((value) => Number(value)).filter((value) => Number.isFinite(value)),
    urgencyLevel: resolveUrgencyLevel(order),
    blockingReasons,
    canCreateSewingDispatchBatch: buildProductionProgressSnapshot(order).canProceedToSewingDispatch,
    updatedAt: DEMO_TODAY,
  }
  cuttingProgressSnapshotCache.set(order.productionOrderId, snapshot)
  return snapshot
}

const emptyStatusDistribution = (): Record<SpecialCraftTaskStatus, number> => ({
  待领料: 0,
  已入待加工仓: 0,
  加工中: 0,
  已完成: 0,
  待交出: 0,
  已交出: 0,
  已回写: 0,
  差异: 0,
  异议中: 0,
  异常: 0,
})

export function buildSpecialCraftProgressSnapshots(options: ProgressStatisticsBuildOptions = {}): SpecialCraftProgressSnapshot[] {
  const tasks = listSpecialCraftTaskOrders()
  const bindings = listCuttingSpecialCraftFeiTicketBindingsForProjection()
  const workOrders = listSpecialCraftTaskWorkOrders()
  const workOrderLines = listSpecialCraftTaskWorkOrderLines()
  const productionOrderMap = new Map(productionOrders.map((order) => [order.productionOrderId, order] as const))
  const groups = new Map<string, SpecialCraftProgressSnapshot>()

  tasks.forEach((task) => {
    const operation = getSpecialCraftOperationById(task.operationId)
    const order = productionOrderMap.get(task.productionOrderId)
    const techPackSpecialCraftSource = order
      ? getTechPackSpecialCraftSourceSummary(order)
      : {
          selectedTargetObjectSummary: [],
          supportedTargetObjectSummary: [],
          bundleLengthCmValues: [],
          bundleWidthCmValues: [],
        }
    const key = [task.operationId, task.factoryId, task.productionOrderId].join('::')
    const existing = groups.get(key) || {
      snapshotId: `SCPS-${key}`,
      operationId: task.operationId,
      operationName: task.operationName,
      factoryId: task.factoryId,
      factoryName: task.factoryName,
      productionOrderId: task.productionOrderId,
      productionOrderNo: task.productionOrderNo,
      targetObjectSummary: [...techPackSpecialCraftSource.selectedTargetObjectSummary],
      supportedTargetObjectSummary: unique([
        ...(operation?.supportedTargetObjectLabels ?? []),
        ...techPackSpecialCraftSource.supportedTargetObjectSummary,
      ]),
      workOrderCount: 0,
      taskCount: 0,
      planQty: 0,
      receivedQty: 0,
      completedQty: 0,
      waitHandoverQty: 0,
      waitDispatchFeiTicketCount: 0,
      dispatchedFeiTicketCount: 0,
      receivedFeiTicketCount: 0,
      processingFeiTicketCount: 0,
      waitReturnFeiTicketCount: 0,
      returnedFeiTicketCount: 0,
      differenceFeiTicketCount: 0,
      objectionFeiTicketCount: 0,
      abnormalCount: 0,
      blockingCount: 0,
      groupBy: '工艺',
      receiveDifferenceTicketCount: 0,
      returnDifferenceTicketCount: 0,
      scrapQty: 0,
      damageQty: 0,
      currentQty: 0,
      bundleWidthCmValues: [...techPackSpecialCraftSource.bundleWidthCmValues],
      bundleLengthCmValues: [...techPackSpecialCraftSource.bundleLengthCmValues],
      stripCountTotal: 0,
      statusDistribution: emptyStatusDistribution(),
      updatedAt: DEMO_TODAY,
    }

    existing.taskCount += 1
    existing.planQty += task.planQty
    existing.receivedQty += task.receivedQty
    existing.completedQty += task.completedQty
    existing.waitHandoverQty += task.waitHandoverQty
    existing.abnormalCount += task.abnormalRecords.length + (task.abnormalStatus === '无异常' ? 0 : 1)
    existing.targetObjectSummary = unique([...existing.targetObjectSummary, task.targetObject])
    existing.statusDistribution[task.status] += 1
    groups.set(key, existing)
  })

  workOrders.forEach((workOrder) => {
    const key = [workOrder.operationId, workOrder.factoryId, workOrder.productionOrderId].join('::')
    const existing = groups.get(key)
    if (!existing) return
    existing.workOrderCount += 1
  })

  workOrderLines.forEach((line) => {
    const workOrder = workOrders.find((item) => item.workOrderId === line.workOrderId)
    if (!workOrder) return
    const key = [workOrder.operationId, workOrder.factoryId, workOrder.productionOrderId].join('::')
    const existing = groups.get(key)
    if (!existing) return
    if (typeof line.bundleWidthCm === 'number' && line.bundleWidthCm > 0) {
      existing.bundleWidthCmValues = unique([...existing.bundleWidthCmValues.map(String), String(line.bundleWidthCm)])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    }
    if (typeof line.bundleLengthCm === 'number' && line.bundleLengthCm > 0) {
      existing.bundleLengthCmValues = unique([...existing.bundleLengthCmValues.map(String), String(line.bundleLengthCm)])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    }
    existing.stripCountTotal += line.stripCount || 0
  })

  bindings.forEach((binding) => {
    const key = [binding.operationId, binding.targetFactoryId, binding.productionOrderId].join('::')
    const existing = groups.get(key)
    if (!existing) return
    if (binding.specialCraftFlowStatus === '待发料' || binding.specialCraftFlowStatus === '待绑定' || binding.specialCraftFlowStatus === '待确认顺序') existing.waitDispatchFeiTicketCount += 1
    if (binding.specialCraftFlowStatus === '已发料') existing.dispatchedFeiTicketCount += 1
    if (binding.specialCraftFlowStatus === '已接收') existing.receivedFeiTicketCount += 1
    if (binding.specialCraftFlowStatus === '加工中') existing.processingFeiTicketCount += 1
    if (binding.specialCraftFlowStatus === '待回仓' || binding.specialCraftFlowStatus === '已完成') existing.waitReturnFeiTicketCount += 1
    if (binding.specialCraftFlowStatus === '已回仓') existing.returnedFeiTicketCount += 1
    if (binding.receiveDifferenceStatus === '待处理' || binding.receiveDifferenceStatus === '处理中') {
      existing.receiveDifferenceTicketCount += 1
      existing.differenceFeiTicketCount += 1
    }
    if (binding.returnDifferenceStatus === '待处理' || binding.returnDifferenceStatus === '处理中') {
      existing.returnDifferenceTicketCount += 1
      existing.differenceFeiTicketCount += 1
    }
    if (binding.objectionStatus === '异议中') existing.objectionFeiTicketCount += 1
    existing.scrapQty += binding.cumulativeScrapQty
    existing.damageQty += binding.cumulativeDamageQty
    existing.currentQty += binding.currentQty
  })

  groups.forEach((snapshot) => {
    snapshot.blockingCount =
      snapshot.waitDispatchFeiTicketCount
      + snapshot.waitReturnFeiTicketCount
      + snapshot.objectionFeiTicketCount
    snapshot.scrapQty = Math.round(snapshot.scrapQty * 100) / 100
    snapshot.damageQty = Math.round(snapshot.damageQty * 100) / 100
    snapshot.currentQty = Math.round(snapshot.currentQty * 100) / 100
  })

  return Array.from(groups.values()).filter((snapshot) =>
    shouldIncludeFactoryInSnapshots(snapshot.factoryId, options),
  )
}

export function buildFactoryWarehouseProgressSnapshots(options: ProgressStatisticsBuildOptions = {}): FactoryWarehouseProgressSnapshot[] {
  const heads = listPdaHandoverHeads()
  return listFactoryInternalWarehouses()
    .filter((warehouse) => !SEWING_FACTORY_TYPES.has(warehouse.factoryKind))
    .filter((warehouse) => shouldIncludeFactoryInSnapshots(warehouse.factoryId, options))
    .reduce<FactoryWarehouseProgressSnapshot[]>((result, warehouse) => {
      if (result.some((item) => item.factoryId === warehouse.factoryId)) return result
      const waitProcess = listFactoryWaitProcessStockItems().filter((item) => item.factoryId === warehouse.factoryId)
      const waitHandover = listFactoryWaitHandoverStockItems().filter((item) => item.factoryId === warehouse.factoryId)
      const inbound = listFactoryWarehouseInboundRecords().filter((item) => item.factoryId === warehouse.factoryId)
      const outbound = listFactoryWarehouseOutboundRecords().filter((item) => item.factoryId === warehouse.factoryId)
      const stocktake = listFactoryWarehouseStocktakeOrders().filter((item) => item.factoryId === warehouse.factoryId)
      const stocktakeReviews = listFactoryWarehouseStocktakeDifferenceReviews().filter((item) => item.factoryId === warehouse.factoryId)
      result.push({
        snapshotId: `FWPS-${warehouse.factoryId}`,
        factoryId: warehouse.factoryId,
        factoryName: warehouse.factoryName,
        waitProcessCount: waitProcess.length,
        waitProcessQty: sum(waitProcess.map((item) => item.receivedQty)),
        waitHandoverCount: waitHandover.length,
        waitHandoverQty: sum(waitHandover.map((item) => item.waitHandoverQty)),
        todayInboundCount: inbound.filter((item) => item.receivedAt.startsWith(DEMO_TODAY)).length,
        todayInboundQty: sum(inbound.filter((item) => item.receivedAt.startsWith(DEMO_TODAY)).map((item) => item.receivedQty)),
        todayOutboundCount: outbound.filter((item) => item.outboundAt.startsWith(DEMO_TODAY)).length,
        todayOutboundQty: sum(outbound.filter((item) => item.outboundAt.startsWith(DEMO_TODAY)).map((item) => item.outboundQty)),
        inboundDifferenceCount: inbound.filter((item) => item.differenceQty !== 0 || item.status === '差异待处理').length,
        outboundDifferenceCount: outbound.filter((item) => (item.differenceQty || 0) !== 0 || item.status === '差异').length,
        objectionCount: outbound.filter((item) => item.status === '异议中').length + waitHandover.filter((item) => item.status === '异议中').length,
        pickupCompletedOrderCount: heads.filter((head) => head.factoryId === warehouse.factoryId && head.headType === 'PICKUP' && head.completionStatus === 'COMPLETED').length,
        handoutCompletedOrderCount: heads.filter((head) => head.factoryId === warehouse.factoryId && head.headType === 'HANDOUT' && head.completionStatus === 'COMPLETED').length,
        stocktakeDifferenceCount: stocktake.reduce((count, order) => count + order.lineList.filter((line) => (line.differenceQty || 0) !== 0).length, 0),
        stocktakeWaitReviewCount: stocktakeReviews.filter((item) => item.reviewStatus !== '已调整').length,
        stocktakeAdjustedCount: stocktakeReviews.filter((item) => item.reviewStatus === '已调整').length,
        overdueCount: waitProcess.filter((item) => item.status === '待领料' || item.status === '差异待处理').length + waitHandover.filter((item) => item.status === '待交出').length,
        updatedAt: DEMO_TODAY,
      })
      return result
    }, [])
}

export function buildProductionProgressKpiSummary(snapshots = getProductionProgressSnapshots()): ProductionProgressKpiSummary {
  return {
    totalProductionOrders: snapshots.length,
    inProgressOrders: snapshots.filter((item) => item.sewingDispatchStatus !== '已全部交出' || item.sewingReceiveStatus !== '已回写').length,
    blockedOrders: snapshots.filter((item) => item.blockingReasons.length > 0).length,
    readyForSewingDispatchOrders: snapshots.filter((item) => item.canProceedToSewingDispatch).length,
    partiallyDispatchedOrders: snapshots.filter((item) => item.sewingDispatchStatus === '部分交出').length,
    fullyDispatchedOrders: snapshots.filter((item) => item.sewingDispatchStatus === '已全部交出').length,
    differenceOrders: snapshots.filter((item) => item.differenceStatus === '差异').length,
    objectionOrders: snapshots.filter((item) => item.objectionStatus === '异议中').length,
    urgentOrders: snapshots.filter((item) => item.urgencyLevel === '十万火急' || item.urgencyLevel === '紧急 A' || item.urgencyLevel === '紧急 B').length,
    updatedAt: DEMO_TODAY,
  }
}

export function getProductionProgressSnapshotByOrder(productionOrderId: string): ProductionProgressSnapshot | undefined {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  return order ? buildProductionProgressSnapshot(order) : undefined
}

let defaultProductionProgressSnapshotsCache: ProductionProgressSnapshot[] | null = null

export function getProductionProgressSnapshots(options: ProgressStatisticsBuildOptions = {}): ProductionProgressSnapshot[] {
  if (isDefaultProgressStatisticsOptions(options) && defaultProductionProgressSnapshotsCache) {
    return defaultProductionProgressSnapshotsCache
  }

  const snapshots = sortProductionProgressByDefaultDueDate(
    productionOrders
      .filter((order) => shouldIncludeOrderInSnapshots(order, options))
      .map((order) => buildProductionProgressSnapshot(order)),
  )

  if (isDefaultProgressStatisticsOptions(options)) {
    defaultProductionProgressSnapshotsCache = snapshots
  }

  return snapshots
}

let defaultCuttingProgressSnapshotsCache: CuttingProgressSnapshot[] | null = null

function isDefaultProgressStatisticsOptions(options: ProgressStatisticsBuildOptions): boolean {
  return Object.keys(options).length === 0
}

export function getCuttingProgressSnapshots(options: ProgressStatisticsBuildOptions = {}): CuttingProgressSnapshot[] {
  if (isDefaultProgressStatisticsOptions(options) && defaultCuttingProgressSnapshotsCache) {
    return defaultCuttingProgressSnapshotsCache
  }

  const snapshots = productionOrders
    .filter((order) => shouldIncludeOrderInSnapshots(order, options))
    .map((order) => buildCuttingProgressSnapshot(order))

  if (isDefaultProgressStatisticsOptions(options)) {
    defaultCuttingProgressSnapshotsCache = snapshots
  }

  return snapshots
}

export function getSpecialCraftProgressSnapshots(options: ProgressStatisticsBuildOptions = {}): SpecialCraftProgressSnapshot[] {
  return buildSpecialCraftProgressSnapshots(options)
}

export function getFactoryWarehouseProgressSnapshots(options: ProgressStatisticsBuildOptions = {}): FactoryWarehouseProgressSnapshot[] {
  return buildFactoryWarehouseProgressSnapshots(options)
}

export function getProgressStatisticsDashboard(options: ProgressStatisticsBuildOptions = {}): {
  kpiSummary: ProductionProgressKpiSummary
  productionSnapshots: ProductionProgressSnapshot[]
  cuttingSnapshots: CuttingProgressSnapshot[]
  specialCraftSnapshots: SpecialCraftProgressSnapshot[]
  factoryWarehouseSnapshots: FactoryWarehouseProgressSnapshot[]
} {
  const productionSnapshots = getProductionProgressSnapshots(options)
  return {
    kpiSummary: buildProductionProgressKpiSummary(productionSnapshots),
    productionSnapshots,
    cuttingSnapshots: getCuttingProgressSnapshots(options),
    specialCraftSnapshots: getSpecialCraftProgressSnapshots(options),
    factoryWarehouseSnapshots: getFactoryWarehouseProgressSnapshots(options),
  }
}

export function assertProgressStatisticsConsistency(): void {
  const snapshots = getProductionProgressSnapshots()
  snapshots.forEach((snapshot) => {
    if (snapshot.sewingDispatchStatus === '已全部交出' && snapshot.totalQty > 0) {
      const sewing = buildSewingDispatchProgressSnapshot(productionOrders.find((item) => item.productionOrderId === snapshot.productionOrderId)!)
      if (sewing.cumulativeDispatchedGarmentQty > snapshot.totalQty) throw new Error(`${snapshot.productionOrderNo} 累计已交出件数超过生产总数`)
      if (sewing.remainingGarmentQty < 0) throw new Error(`${snapshot.productionOrderNo} 剩余未交出件数小于 0`)
    }
  })

  const sewingFactoryWarehouse = getFactoryWarehouseProgressSnapshots().find((item) => item.factoryName.includes('车缝厂'))
  if (sewingFactoryWarehouse) throw new Error('车缝厂不应进入工厂内部仓统计')

  getCuttingProgressSnapshots().forEach((snapshot) => {
    if (snapshot.sewingDispatchProgress.completedQty > snapshot.sewingDispatchProgress.plannedQty) {
      throw new Error(`${snapshot.productionOrderNo} 裁片交出完成数不得超过计划数`)
    }
    if (snapshot.sewingDispatchProgress.differenceQty < 0) {
      throw new Error(`${snapshot.productionOrderNo} 裁片交出差异数不得小于 0`)
    }
  })
}
