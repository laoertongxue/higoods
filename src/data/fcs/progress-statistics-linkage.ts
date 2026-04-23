import { productionOrders, type ProductionOrder } from './production-orders.ts'
import { cuttingMaterialPrepGroups } from './cutting/material-prep.ts'
import { listGeneratedFeiTicketsByProductionOrderId } from './cutting/generated-fei-tickets.ts'
import {
  getCuttingSpecialCraftReturnStatusByProductionOrder,
  listCuttingSpecialCraftFeiTicketBindings,
} from './cutting/special-craft-fei-ticket-flow.ts'
import {
  getCuttingSewingDispatchProgressByProductionOrder,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingTransferBags,
} from './cutting/sewing-dispatch.ts'
import {
  listFactoryInternalWarehouses,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
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
  listSpecialCraftTaskOrders,
  type SpecialCraftTaskStatus,
} from './special-craft-task-orders.ts'

// 统计结果只作为只读投影，不作为状态源头。
const DEMO_TODAY = '2026-04-23'
const SEWING_FACTORY_TYPES = new Set(['CENTRAL_GARMENT', 'SATELLITE_SEWING', 'THIRD_SEWING'])

export interface ProgressBlockingReason {
  reasonId: string
  productionOrderId: string
  productionOrderNo: string
  sourceModule: '生产单' | '配料' | '领料' | '裁床' | '菲票' | '特殊工艺' | '裁片发料' | '交接' | '工厂仓库'
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
  materialPrepStatus: '未配置' | '部分配置' | '已配置'
  cuttingPickupStatus: '待领料' | '已领料' | '差异待处理'
  cuttingStatus: '待裁剪' | '裁剪中' | '已裁剪' | '异常'
  feiTicketStatus: '未生成' | '部分生成' | '已生成'
  cuttingWaitHandoverStatus: '未入仓' | '部分入仓' | '已入裁床厂待交出仓'
  specialCraftStatus: '无特殊工艺' | '待发料' | '加工中' | '待回仓' | '已回仓' | '差异' | '异议中'
  specialCraftReturnStatus: '不需要回仓' | '未回仓' | '部分回仓' | '已回仓' | '差异' | '异议中'
  sewingDispatchStatus: '未发料' | '部分发料' | '已全部发料' | '差异' | '异议中'
  sewingReceiveStatus: '未回写' | '部分回写' | '已回写' | '差异' | '异议中'
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
  replenishmentProgress: CuttingProgressMetric
  feiTicketProgress: CuttingProgressMetric
  cutPieceWarehouseProgress: CuttingProgressMetric
  specialCraftDispatchProgress: CuttingProgressMetric
  specialCraftReturnProgress: CuttingProgressMetric
  sewingDispatchProgress: CuttingProgressMetric
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
  stocktakeDifferenceCount: number
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
  completedTransferBagCount: number
  dispatchedTransferBagCount: number
  writtenBackTransferBagCount: number
  differenceTransferBagCount: number
  objectionTransferBagCount: number
  canCreateNextBatch: boolean
  blockingReasons: string[]
  updatedAt: string
}

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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
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

function getDueDate(order: ProductionOrder): string {
  return order.planEndDate || order.demandSnapshot.requiredDeliveryDate || ''
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
  if (!lines.length) return order.techPackSnapshot ? '已配置' : '未配置'
  if (lines.every((line) => line.configStatus === 'CONFIGURED')) return '已配置'
  if (lines.some((line) => line.configuredLength > 0 || line.configuredRollCount > 0)) return '部分配置'
  return '未配置'
}

function resolveCuttingPickupStatus(order: ProductionOrder): ProductionProgressSnapshot['cuttingPickupStatus'] {
  const lines = getMaterialPrepRows(order)
  if (lines.some((line) => line.receiveStatus === 'RECHECK' || line.discrepancyStatus !== 'NONE')) return '差异待处理'
  if (!lines.length) return order.status === 'EXECUTING' || order.status === 'COMPLETED' ? '已领料' : '待领料'
  if (lines.some((line) => line.receivedLength > 0 || line.receivedRollCount > 0)) return '已领料'
  return '待领料'
}

function resolveFeiTicketStatus(order: ProductionOrder): ProductionProgressSnapshot['feiTicketStatus'] {
  const tickets = listGeneratedFeiTicketsByProductionOrderId(order.productionOrderId)
  if (tickets.length === 0) return '未生成'
  const expectedLines = getMaterialPrepRows(order).length
  if (expectedLines > 0 && tickets.length < expectedLines) return '部分生成'
  return '已生成'
}

function resolveCuttingStatus(order: ProductionOrder): ProductionProgressSnapshot['cuttingStatus'] {
  const tickets = listGeneratedFeiTicketsByProductionOrderId(order.productionOrderId)
  if (tickets.length > 0) return '已裁剪'
  if (order.status === 'EXECUTING') return '裁剪中'
  return '待裁剪'
}

function resolveCuttingWaitHandoverStatus(order: ProductionOrder): ProductionProgressSnapshot['cuttingWaitHandoverStatus'] {
  const ticketCount = listGeneratedFeiTicketsByProductionOrderId(order.productionOrderId).length
  const waitHandoverItems = listFactoryWaitHandoverStockItems().filter((item) => item.productionOrderId === order.productionOrderId)
  if (waitHandoverItems.length === 0) return '未入仓'
  if (ticketCount > 0 && waitHandoverItems.length < ticketCount) return '部分入仓'
  return '已入裁床厂待交出仓'
}

function resolveSpecialCraftStatus(order: ProductionOrder): ProductionProgressSnapshot['specialCraftStatus'] {
  const tasks = getSpecialCraftTasksByProductionOrder(order.productionOrderId)
  if (!tasks.length) return '无特殊工艺'
  const returnStatus = getCuttingSpecialCraftReturnStatusByProductionOrder(order.productionOrderId)
  if (returnStatus.differenceCount > 0) return '差异'
  if (returnStatus.objectionCount > 0) return '异议中'
  if (returnStatus.totalNeedSpecialCraftFeiTickets > 0 && returnStatus.allReturned) return '已回仓'
  if (returnStatus.waitReturnCount > 0) return '待回仓'
  if (returnStatus.receivedBySpecialFactoryCount > 0 || tasks.some((task) => task.status === '加工中')) return '加工中'
  return '待发料'
}

function resolveSpecialCraftReturnStatus(order: ProductionOrder): ProductionProgressSnapshot['specialCraftReturnStatus'] {
  const status = getCuttingSpecialCraftReturnStatusByProductionOrder(order.productionOrderId)
  if (status.totalNeedSpecialCraftFeiTickets === 0) return '不需要回仓'
  if (status.differenceCount > 0) return '差异'
  if (status.objectionCount > 0) return '异议中'
  if (status.allReturned) return '已回仓'
  if (status.returnedCount > 0) return '部分回仓'
  return '未回仓'
}

export function buildSewingDispatchProgressSnapshot(order: ProductionOrder): SewingDispatchProgressSnapshot {
  const progress = getCuttingSewingDispatchProgressByProductionOrder(order.productionOrderId)
  const dispatchOrders = listCuttingSewingDispatchOrders().filter((item) => item.productionOrderId === order.productionOrderId)
  const dispatchBatches = listCuttingSewingDispatchBatches().filter((item) => item.productionOrderId === order.productionOrderId)
  const transferBags = listCuttingSewingTransferBags().filter((item) => item.productionOrderId === order.productionOrderId)
  return {
    snapshotId: `SPD-${order.productionOrderId}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    totalProductionQty: progress.totalProductionQty,
    cumulativeDispatchedGarmentQty: progress.cumulativeDispatchedGarmentQty,
    remainingGarmentQty: progress.remainingGarmentQty,
    dispatchOrderCount: dispatchOrders.length,
    dispatchBatchCount: progress.dispatchBatchCount,
    transferOrderCount: dispatchBatches.length,
    transferBagCount: progress.transferBagCount,
    completedTransferBagCount: transferBags.filter((bag) => bag.completeStatus === '已配齐').length,
    dispatchedTransferBagCount: progress.dispatchedTransferBagCount,
    writtenBackTransferBagCount: progress.writtenBackTransferBagCount,
    differenceTransferBagCount: progress.differenceTransferBagCount,
    objectionTransferBagCount: progress.objectionTransferBagCount,
    canCreateNextBatch: progress.canCreateNextBatch,
    blockingReasons: progress.blockingReasons,
    updatedAt: DEMO_TODAY,
  }
}

function resolveSewingDispatchStatus(snapshot: SewingDispatchProgressSnapshot): ProductionProgressSnapshot['sewingDispatchStatus'] {
  if (snapshot.differenceTransferBagCount > 0) return '差异'
  if (snapshot.objectionTransferBagCount > 0) return '异议中'
  if (snapshot.cumulativeDispatchedGarmentQty <= 0) return '未发料'
  if (snapshot.remainingGarmentQty > 0) return '部分发料'
  return '已全部发料'
}

function resolveSewingReceiveStatus(snapshot: SewingDispatchProgressSnapshot): ProductionProgressSnapshot['sewingReceiveStatus'] {
  if (snapshot.differenceTransferBagCount > 0) return '差异'
  if (snapshot.objectionTransferBagCount > 0) return '异议中'
  if (snapshot.writtenBackTransferBagCount <= 0) return '未回写'
  if (snapshot.writtenBackTransferBagCount < snapshot.dispatchedTransferBagCount) return '部分回写'
  return '已回写'
}

export function buildHandoverProgressSnapshot(order: ProductionOrder): HandoverProgressSnapshot {
  const heads = listPdaHandoverHeads().filter((head) => head.productionOrderNo === order.productionOrderNo)
  const records = heads.flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
  const writebacks = listReceiverWritebacks().filter((item) => heads.some((head) => head.handoverId === item.handoverOrderId || head.handoverOrderId === item.handoverOrderId))
  const objections = listQuantityObjections().filter((item) => item.productionOrderId === order.productionOrderId || heads.some((head) => head.handoverOrderId === item.handoverOrderId))
  const factoryId = heads[0]?.factoryId || order.mainFactoryId
  const factoryName = heads[0]?.sourceFactoryName || order.mainFactorySnapshot.name
  return {
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
    waitWritebackCount: records.filter((record) => typeof record.receiverWrittenQty !== 'number' && typeof record.warehouseWrittenQty !== 'number').length,
    writtenBackCount: records.filter((record) => typeof record.receiverWrittenQty === 'number' || typeof record.warehouseWrittenQty === 'number').length,
    differenceCount: records.filter((record) => (record.diffQty || 0) !== 0).length + writebacks.filter((item) => item.diffQty !== 0).length,
    objectionCount: objections.length,
    updatedAt: DEMO_TODAY,
  }
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

  if (materialPrepStatus === '未配置') add('配料', order.productionOrderNo, '面料未配置', '配置面料', '/fcs/craft/cutting/material-prep', '加急')
  if (materialPrepStatus === '部分配置') add('配料', order.productionOrderNo, '面料部分配置', '配置面料', '/fcs/craft/cutting/material-prep', '普通')
  if (pickupStatus === '待领料') add('领料', order.productionOrderNo, '面料未领料', '裁床领料', '/fcs/craft/cutting/material-prep')
  if (pickupStatus === '差异待处理') add('领料', order.productionOrderNo, '领料差异待处理', '处理差异', '/fcs/progress/handover', '紧急')
  if (cuttingStatus !== '已裁剪') add('裁床', order.productionOrderNo, cuttingStatus === '裁剪中' ? '裁剪未完成' : '唛架未完成', '裁剪', '/fcs/craft/cutting/production-progress')
  if (feiStatus !== '已生成') add('菲票', order.productionOrderNo, '菲票未生成', '打印菲票', '/fcs/craft/cutting/fei-tickets')
  if (waitHandoverStatus !== '已入裁床厂待交出仓') add('裁床', order.productionOrderNo, '裁片未入裁床厂待交出仓', '裁片入仓', '/fcs/craft/cutting/production-progress')
  if (specialReturnStatus === '未回仓' || specialReturnStatus === '部分回仓') add('特殊工艺', order.productionOrderNo, '特殊工艺未回仓', '等待特殊工艺回仓', '/fcs/craft/cutting/special-craft-return', '加急')
  if (specialReturnStatus === '差异') add('特殊工艺', order.productionOrderNo, '特殊工艺差异', '处理差异', '/fcs/craft/cutting/special-craft-return', '紧急')
  if (specialReturnStatus === '异议中') add('特殊工艺', order.productionOrderNo, '特殊工艺异议中', '处理异议', '/fcs/craft/cutting/special-craft-return', '紧急')
  sewingSnapshot.blockingReasons.forEach((reason) => {
    add('裁片发料', order.productionOrderNo, reason || '裁片未配齐', '裁片发料', '/fcs/craft/cutting/sewing-dispatch', '加急')
  })
  if (handoverSnapshot.differenceCount > 0) add('交接', order.productionOrderNo, '交接差异', '处理差异', '/fcs/progress/handover', '紧急')
  if (handoverSnapshot.objectionCount > 0) add('交接', order.productionOrderNo, '数量异议中', '处理异议', '/fcs/progress/handover', '紧急')

  return reasons.map((reason, index) => makeBlockingReason(
    order,
    index + 1,
    reason.sourceModule,
    reason.sourceRecordNo,
    reason.blockingLabel,
    reason.nextActionLabel,
    reason.relatedRoute,
    reason.severity,
  ))
}

function resolveNextAction(snapshot: Omit<ProductionProgressSnapshot, 'nextActionLabel'> & { blockingReasons: ProgressBlockingReason[] }): string {
  if (snapshot.blockingReasons.length > 0) return snapshot.blockingReasons[0].nextActionLabel
  if (snapshot.sewingDispatchStatus === '未发料' || snapshot.sewingDispatchStatus === '部分发料') return '裁片发料'
  if (snapshot.sewingReceiveStatus !== '已回写') return '等待车缝回写'
  return '已完成当前节点'
}

export function buildProductionProgressSnapshot(order: ProductionOrder): ProductionProgressSnapshot {
  const sewingSnapshot = buildSewingDispatchProgressSnapshot(order)
  const handoverSnapshot = buildHandoverProgressSnapshot(order)
  const specialCraftReturnStatus = resolveSpecialCraftReturnStatus(order)
  const blockingReasons = buildProgressBlockingReasons(order)
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
    sewingDispatchStatus: resolveSewingDispatchStatus(sewingSnapshot),
    sewingReceiveStatus: resolveSewingReceiveStatus(sewingSnapshot),
    handoverStatus: resolveHandoverStatus(handoverSnapshot),
    differenceStatus: handoverSnapshot.differenceCount > 0 || sewingSnapshot.differenceTransferBagCount > 0 || specialCraftReturnStatus === '差异' ? '差异' : '无差异',
    objectionStatus: handoverSnapshot.objectionCount > 0 || sewingSnapshot.objectionTransferBagCount > 0 || specialCraftReturnStatus === '异议中' ? '异议中' : '无异议',
    canProceedToSewingDispatch:
      specialCraftReturnStatus !== '未回仓'
      && specialCraftReturnStatus !== '部分回仓'
      && specialCraftReturnStatus !== '差异'
      && specialCraftReturnStatus !== '异议中'
      && sewingSnapshot.canCreateNextBatch,
    blockingReasons,
    updatedAt: DEMO_TODAY,
  } satisfies Omit<ProductionProgressSnapshot, 'nextActionLabel'>

  return {
    ...partialSnapshot,
    nextActionLabel: resolveNextAction(partialSnapshot),
  }
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
  const prepRows = getMaterialPrepRows(order)
  const tickets = listGeneratedFeiTicketsByProductionOrderId(order.productionOrderId)
  const specialReturn = getCuttingSpecialCraftReturnStatusByProductionOrder(order.productionOrderId)
  const sewing = buildSewingDispatchProgressSnapshot(order)
  const blockingReasons = buildProgressBlockingReasons(order)
  const cuttingOrderNos = unique(prepRows.map((line) => line.cutPieceOrderNo).concat(tickets.map((ticket) => ticket.originalCutOrderNo)))
  return {
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
    replenishmentProgress: metric(prepRows.some((line) => line.issueFlags.includes('待补料')) ? '待补料' : '正常', prepRows.length, prepRows.filter((line) => !line.issueFlags.includes('待补料')).length, 0, prepRows.filter((line) => line.issueFlags.includes('待补料')).length),
    feiTicketProgress: metric(resolveFeiTicketStatus(order), prepRows.length || tickets.length, tickets.length, 0, 0),
    cutPieceWarehouseProgress: metric(resolveCuttingWaitHandoverStatus(order), tickets.length, listFactoryWaitHandoverStockItems().filter((item) => item.productionOrderId === order.productionOrderId).length, 0, 0),
    specialCraftDispatchProgress: metric(specialReturn.waitDispatchCount > 0 ? '待发料' : '已发料', specialReturn.totalNeedSpecialCraftFeiTickets, specialReturn.dispatchedCount, specialReturn.differenceCount, specialReturn.objectionCount),
    specialCraftReturnProgress: metric(resolveSpecialCraftReturnStatus(order), specialReturn.totalNeedSpecialCraftFeiTickets, specialReturn.returnedCount, specialReturn.differenceCount, specialReturn.objectionCount),
    sewingDispatchProgress: metric(resolveSewingDispatchStatus(sewing), sewing.totalProductionQty, sewing.cumulativeDispatchedGarmentQty, sewing.differenceTransferBagCount, sewing.objectionTransferBagCount),
    urgencyLevel: resolveUrgencyLevel(order),
    blockingReasons,
    canCreateSewingDispatchBatch: buildProductionProgressSnapshot(order).canProceedToSewingDispatch,
    updatedAt: DEMO_TODAY,
  }
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

export function buildSpecialCraftProgressSnapshots(): SpecialCraftProgressSnapshot[] {
  const tasks = listSpecialCraftTaskOrders()
  const bindings = listCuttingSpecialCraftFeiTicketBindings()
  const groups = new Map<string, SpecialCraftProgressSnapshot>()

  tasks.forEach((task) => {
    const key = [task.operationId, task.factoryId, task.productionOrderId].join('::')
    const existing = groups.get(key) || {
      snapshotId: `SCPS-${key}`,
      operationId: task.operationId,
      operationName: task.operationName,
      factoryId: task.factoryId,
      factoryName: task.factoryName,
      productionOrderId: task.productionOrderId,
      productionOrderNo: task.productionOrderNo,
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
      statusDistribution: emptyStatusDistribution(),
      updatedAt: DEMO_TODAY,
    }

    existing.taskCount += 1
    existing.planQty += task.planQty
    existing.receivedQty += task.receivedQty
    existing.completedQty += task.completedQty
    existing.waitHandoverQty += task.waitHandoverQty
    existing.abnormalCount += task.abnormalRecords.length + (task.abnormalStatus === '无异常' ? 0 : 1)
    existing.statusDistribution[task.status] += 1
    groups.set(key, existing)
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
    if (binding.specialCraftFlowStatus === '差异') existing.differenceFeiTicketCount += 1
    if (binding.specialCraftFlowStatus === '异议中') existing.objectionFeiTicketCount += 1
  })

  groups.forEach((snapshot) => {
    snapshot.blockingCount =
      snapshot.waitDispatchFeiTicketCount
      + snapshot.waitReturnFeiTicketCount
      + snapshot.differenceFeiTicketCount
      + snapshot.objectionFeiTicketCount
  })

  return Array.from(groups.values())
}

export function buildFactoryWarehouseProgressSnapshots(): FactoryWarehouseProgressSnapshot[] {
  return listFactoryInternalWarehouses()
    .filter((warehouse) => !SEWING_FACTORY_TYPES.has(warehouse.factoryKind))
    .reduce<FactoryWarehouseProgressSnapshot[]>((result, warehouse) => {
      if (result.some((item) => item.factoryId === warehouse.factoryId)) return result
      const waitProcess = listFactoryWaitProcessStockItems().filter((item) => item.factoryId === warehouse.factoryId)
      const waitHandover = listFactoryWaitHandoverStockItems().filter((item) => item.factoryId === warehouse.factoryId)
      const inbound = listFactoryWarehouseInboundRecords().filter((item) => item.factoryId === warehouse.factoryId)
      const outbound = listFactoryWarehouseOutboundRecords().filter((item) => item.factoryId === warehouse.factoryId)
      const stocktake = listFactoryWarehouseStocktakeOrders().filter((item) => item.factoryId === warehouse.factoryId)
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
        stocktakeDifferenceCount: stocktake.reduce((count, order) => count + order.lineList.filter((line) => (line.differenceQty || 0) !== 0).length, 0),
        overdueCount: waitProcess.filter((item) => item.status === '待领料' || item.status === '差异待处理').length + waitHandover.filter((item) => item.status === '待交出').length,
        updatedAt: DEMO_TODAY,
      })
      return result
    }, [])
}

export function buildProductionProgressKpiSummary(snapshots = getProductionProgressSnapshots()): ProductionProgressKpiSummary {
  return {
    totalProductionOrders: snapshots.length,
    inProgressOrders: snapshots.filter((item) => item.sewingDispatchStatus !== '已全部发料' || item.sewingReceiveStatus !== '已回写').length,
    blockedOrders: snapshots.filter((item) => item.blockingReasons.length > 0).length,
    readyForSewingDispatchOrders: snapshots.filter((item) => item.canProceedToSewingDispatch).length,
    partiallyDispatchedOrders: snapshots.filter((item) => item.sewingDispatchStatus === '部分发料').length,
    fullyDispatchedOrders: snapshots.filter((item) => item.sewingDispatchStatus === '已全部发料').length,
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

export function getProductionProgressSnapshots(): ProductionProgressSnapshot[] {
  return productionOrders.map((order) => buildProductionProgressSnapshot(order))
}

export function getCuttingProgressSnapshots(): CuttingProgressSnapshot[] {
  return productionOrders.map((order) => buildCuttingProgressSnapshot(order))
}

export function getSpecialCraftProgressSnapshots(): SpecialCraftProgressSnapshot[] {
  return buildSpecialCraftProgressSnapshots()
}

export function getFactoryWarehouseProgressSnapshots(): FactoryWarehouseProgressSnapshot[] {
  return buildFactoryWarehouseProgressSnapshots()
}

export function getProgressStatisticsDashboard(): {
  kpiSummary: ProductionProgressKpiSummary
  productionSnapshots: ProductionProgressSnapshot[]
  cuttingSnapshots: CuttingProgressSnapshot[]
  specialCraftSnapshots: SpecialCraftProgressSnapshot[]
  factoryWarehouseSnapshots: FactoryWarehouseProgressSnapshot[]
} {
  const productionSnapshots = getProductionProgressSnapshots()
  return {
    kpiSummary: buildProductionProgressKpiSummary(productionSnapshots),
    productionSnapshots,
    cuttingSnapshots: getCuttingProgressSnapshots(),
    specialCraftSnapshots: getSpecialCraftProgressSnapshots(),
    factoryWarehouseSnapshots: getFactoryWarehouseProgressSnapshots(),
  }
}

export function assertProgressStatisticsConsistency(): void {
  const snapshots = getProductionProgressSnapshots()
  snapshots.forEach((snapshot) => {
    if (snapshot.sewingDispatchStatus === '已全部发料' && snapshot.totalQty > 0) {
      const sewing = buildSewingDispatchProgressSnapshot(productionOrders.find((item) => item.productionOrderId === snapshot.productionOrderId)!)
      if (sewing.cumulativeDispatchedGarmentQty > snapshot.totalQty) throw new Error(`${snapshot.productionOrderNo} 累计已发件数超过生产总数`)
      if (sewing.remainingGarmentQty < 0) throw new Error(`${snapshot.productionOrderNo} 剩余未发件数小于 0`)
    }
    if ((snapshot.specialCraftReturnStatus === '未回仓' || snapshot.specialCraftReturnStatus === '部分回仓') && snapshot.canProceedToSewingDispatch) {
      throw new Error(`${snapshot.productionOrderNo} 特殊工艺未回仓时不可标记为可发车缝`)
    }
  })

  const sewingFactoryWarehouse = getFactoryWarehouseProgressSnapshots().find((item) => item.factoryName.includes('车缝'))
  if (sewingFactoryWarehouse) throw new Error('车缝厂不应进入工厂内部仓统计')

  listCuttingSewingDispatchBatches().forEach((batch) => {
    if (batch.completeStatus !== '已配齐' && batch.status === '已交出') throw new Error(`${batch.transferOrderNo} 中转袋未配齐时不可交出`)
    const submittedPieceQty = sum(
      listCuttingSewingTransferBags()
        .filter((bag) => batch.transferBagIds.includes(bag.transferBagId))
        .map((bag) => bag.pieceLines.reduce((total, line) => total + line.scannedPieceQty, 0)),
    )
    if ((batch.receiverWrittenQty || 0) > submittedPieceQty) throw new Error(`${batch.transferOrderNo} 已回写数量不得超过已交出数量`)
  })
}
