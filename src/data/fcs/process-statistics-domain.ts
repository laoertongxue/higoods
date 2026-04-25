import { listProcessWorkOrders, type ProcessWorkOrder, type ProcessWorkOrderType } from './process-work-order-domain.ts'
import {
  listProcessHandoverDifferenceRecords,
  listProcessHandoverRecords,
  listProcessWarehouseReviewRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
  type ProcessHandoverDifferenceRecord,
  type ProcessHandoverRecord,
  type ProcessWarehouseCraftType,
  type ProcessWarehouseObjectType,
  type ProcessWarehouseRecord,
} from './process-warehouse-domain.ts'
import { listCuttingSpecialCraftFeiTicketBindings, listSpecialCraftQtyDifferenceReports } from './cutting/special-craft-fei-ticket-flow.ts'
import { getSpecialCraftTaskOrders, listSpecialCraftTaskOrders } from './special-craft-task-orders.ts'
import {
  listPostFinishingActionRecords,
  listPostFinishingQcOrders,
  listPostFinishingRecheckOrders,
  listPostFinishingWorkOrders,
  type PostFinishingActionRecord,
  type PostFinishingWorkOrder,
} from './post-finishing-domain.ts'
import { listDyeVatSchedules } from './dyeing-task-domain.ts'

type QtyField = 'plannedObjectQty' | 'receivedObjectQty' | 'availableObjectQty' | 'handedOverObjectQty' | 'writtenBackObjectQty' | 'diffObjectQty'
type HandoverQtyField = 'handoverObjectQty' | 'receiveObjectQty' | 'diffObjectQty'

export interface ProcessStatisticsFilter {
  factoryId?: string
  craftName?: string
  workOrderId?: string
  timeRange?: 'TODAY' | '7D' | '30D'
}

export interface StatusCountRow {
  label: string
  count: number
}

export interface FactoryMetricRow {
  factoryId: string
  factoryName: string
  workOrderCount: number
  plannedQty: number
  doneQty: number
  handoverQty: number
  diffQty: number
  completionRate: number
}

interface BaseExecutionStatistics {
  workOrderCount: number
  statusCounts: Record<string, number>
  statusRows: StatusCountRow[]
  factoryRows: FactoryMetricRow[]
  waitProcessRecordCount: number
  waitHandoverRecordCount: number
  partialHandoverRecordCount: number
  waitWritebackHandoverCount: number
  writtenBackHandoverCount: number
  differenceHandoverCount: number
  differenceRecordCount: number
  pendingDifferenceRecordCount: number
  reworkDifferenceRecordCount: number
  platformProcessingDifferenceRecordCount: number
  waitReviewCount: number
  reviewPassCount: number
  reviewRejectCount: number
  handoverAverageWritebackHours: number
  overdueWritebackCount: number
}

export interface PrintingExecutionStatistics extends BaseExecutionStatistics {
  plannedPrintFabricMeters: number
  printCompletedFabricMeters: number
  transferCompletedFabricMeters: number
  waitProcessFabricMeters: number
  waitHandoverFabricMeters: number
  handedOverFabricMeters: number
  receivedFabricMeters: number
  diffFabricMeters: number
  usedMaterialMeters: number
  printAverageHours: number
  transferAverageHours: number
}

export interface DyeingExecutionStatistics extends BaseExecutionStatistics {
  plannedDyeFabricMeters: number
  materialReadyFabricMeters: number
  dyeCompletedFabricMeters: number
  finalPackedFabricMeters: number
  waitProcessFabricMeters: number
  waitHandoverFabricMeters: number
  handedOverFabricMeters: number
  receivedFabricMeters: number
  diffFabricMeters: number
  currentVatScheduleCount: number
  dyeAverageHours: number
  dehydrateAverageHours: number
  dryAverageHours: number
  setAverageHours: number
  rollAverageHours: number
  packAverageHours: number
}

export interface SpecialCraftExecutionStatistics extends BaseExecutionStatistics {
  craftRows: StatusCountRow[]
  taskOrderCount: number
  waitProcessPieceQty: number
  receivedPieceQty: number
  completedPieceQty: number
  waitHandoverPieceQty: number
  handedOverPieceQty: number
  receivedHandoverPieceQty: number
  diffPieceQty: number
  currentPieceQty: number
  scrapPieceQty: number
  damagePieceQty: number
  feiTicketCount: number
  waitProcessFeiTicketCount: number
  completedFeiTicketCount: number
  differenceFeiTicketCount: number
  scrapFeiTicketCount: number
  damageFeiTicketCount: number
  lessReceivePieceQty: number
  moreReceivePieceQty: number
  averageProcessHours: number
}

export interface PostFinishingExecutionStatistics extends BaseExecutionStatistics {
  postOrderCount: number
  waitReceiveTaskCount: number
  receiveDoneGarmentQty: number
  receiveDiffGarmentQty: number
  waitPostTaskCount: number
  postDoingTaskCount: number
  postDoneTaskCount: number
  waitQcTaskCount: number
  qcDoingTaskCount: number
  qcDoneTaskCount: number
  waitRecheckTaskCount: number
  recheckDoingTaskCount: number
  recheckDoneTaskCount: number
  waitHandoverTaskCount: number
  handedOverTaskCount: number
  completedTaskCount: number
  waitPostGarmentQty: number
  postDoneGarmentQty: number
  waitQcGarmentQty: number
  qcPassGarmentQty: number
  qcRejectedGarmentQty: number
  waitRecheckGarmentQty: number
  recheckConfirmedGarmentQty: number
  waitHandoverGarmentQty: number
  handedOverGarmentQty: number
  receivedGarmentQty: number
  diffGarmentQty: number
  dedicatedTaskCount: number
  postFactoryExecutedTaskCount: number
  sewingFactoryPostDoneTaskCount: number
  dedicatedWaitQcGarmentQty: number
  dedicatedWaitRecheckGarmentQty: number
  transferWaitManagedFactoryTaskCount: number
  transferInWaitQcGarmentQty: number
  transferInWaitRecheckGarmentQty: number
  lessReceiveGarmentQty: number
  moreReceiveGarmentQty: number
  postAverageHours: number
  qcAverageHours: number
  recheckAverageHours: number
}

export interface DashboardMetrics<TStatistics> {
  statistics: TStatistics
  statusRows: StatusCountRow[]
  factoryRows: FactoryMetricRow[]
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function parseTime(value?: string): number {
  if (!value) return 0
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function durationHours(start?: string, end?: string): number {
  const startAt = parseTime(start)
  const endAt = parseTime(end)
  if (!startAt || !endAt || endAt < startAt) return 0
  return (endAt - startAt) / 1000 / 60 / 60
}

function matchTimeRange(value: string | undefined, range?: ProcessStatisticsFilter['timeRange']): boolean {
  if (!range || range === '30D') return true
  const timestamp = parseTime(value)
  if (!timestamp) return true
  const now = Date.now()
  const limit = range === 'TODAY' ? 1 : 7
  return now - timestamp <= limit * 24 * 60 * 60 * 1000
}

function getNodeQty(node: unknown): number {
  const input = node as { outputQty?: number; actualCompletedQty?: number; usedMaterialQty?: number }
  return Number(input.actualCompletedQty ?? input.outputQty ?? input.usedMaterialQty ?? 0)
}

function filterProcessOrders(type: ProcessWorkOrderType, filter: ProcessStatisticsFilter = {}): ProcessWorkOrder[] {
  return listProcessWorkOrders(type).filter((order) =>
    (!filter.workOrderId || order.workOrderId === filter.workOrderId)
    && (!filter.factoryId || order.factoryId === filter.factoryId)
    && matchTimeRange(order.updatedAt || order.createdAt, filter.timeRange),
  )
}

function filterWarehouseRecords(craftType: ProcessWarehouseCraftType, filter: ProcessStatisticsFilter = {}) {
  const base = {
    craftType,
    craftName: filter.craftName,
    sourceWorkOrderId: filter.workOrderId,
    targetFactoryId: filter.factoryId,
  }
  return {
    waitProcess: listWaitProcessWarehouseRecords(base).filter((record) => matchTimeRange(record.updatedAt || record.createdAt, filter.timeRange)),
    waitHandover: listWaitHandoverWarehouseRecords(base).filter((record) => matchTimeRange(record.updatedAt || record.createdAt, filter.timeRange)),
    handovers: listProcessHandoverRecords({
      craftType,
      craftName: filter.craftName,
      sourceWorkOrderId: filter.workOrderId,
    }).filter((record) => (!filter.factoryId || record.handoverFactoryId === filter.factoryId) && matchTimeRange(record.handoverAt, filter.timeRange)),
    differences: listProcessHandoverDifferenceRecords({
      craftType,
      craftName: filter.craftName,
      sourceWorkOrderId: filter.workOrderId,
    }).filter((record) => matchTimeRange(record.reportedAt, filter.timeRange)),
    reviews: listProcessWarehouseReviewRecords({
      craftType,
      craftName: filter.craftName,
      sourceWorkOrderId: filter.workOrderId,
    }).filter((record) => matchTimeRange(record.reviewedAt, filter.timeRange)),
  }
}

export function sumWarehouseQty(records: ProcessWarehouseRecord[], objectType: ProcessWarehouseObjectType | undefined, qtyField: QtyField): number {
  return round(records
    .filter((record) => !objectType || record.objectType === objectType)
    .reduce((sum, record) => sum + Number(record[qtyField] || 0), 0))
}

export function sumHandoverQty(records: ProcessHandoverRecord[], objectType: ProcessWarehouseObjectType | undefined, qtyField: HandoverQtyField): number {
  return round(records
    .filter((record) => !objectType || record.objectType === objectType)
    .reduce((sum, record) => sum + Math.abs(Number(record[qtyField] || 0)), 0))
}

export function countByStatus<T extends { status?: string; statusLabel?: string; currentStatus?: string; reviewStatus?: string }>(records: T[]): Record<string, number> {
  return records.reduce<Record<string, number>>((result, record) => {
    const key = record.statusLabel || record.currentStatus || record.reviewStatus || record.status || '未标记'
    result[key] = (result[key] || 0) + 1
    return result
  }, {})
}

export function countByCraftType<T extends { craftType?: string }>(records: T[]): Record<string, number> {
  return records.reduce<Record<string, number>>((result, record) => {
    const key = record.craftType || '未标记'
    result[key] = (result[key] || 0) + 1
    return result
  }, {})
}

export function countByFactory<T extends { factoryId?: string; factoryName?: string; targetFactoryId?: string; targetFactoryName?: string; handoverFactoryId?: string; handoverFactoryName?: string }>(records: T[]): Record<string, number> {
  return records.reduce<Record<string, number>>((result, record) => {
    const key = record.factoryName || record.targetFactoryName || record.handoverFactoryName || record.factoryId || record.targetFactoryId || record.handoverFactoryId || '未标记工厂'
    result[key] = (result[key] || 0) + 1
    return result
  }, {})
}

export function countByCurrentAction<T extends { currentActionName?: string }>(records: T[]): Record<string, number> {
  return records.reduce<Record<string, number>>((result, record) => {
    const key = record.currentActionName || '未标记动作'
    result[key] = (result[key] || 0) + 1
    return result
  }, {})
}

export function calcDiffRate(expectedQty: number, actualQty: number): number {
  if (!expectedQty) return 0
  return round(Math.abs(expectedQty - actualQty) / expectedQty * 100)
}

export function calcCompletionRate(doneQty: number, plannedQty: number): number {
  if (!plannedQty) return 0
  return round(doneQty / plannedQty * 100)
}

export function calcAverageDuration(nodes: Array<{ startedAt?: string; finishedAt?: string }>): number {
  const durations = nodes.map((node) => durationHours(node.startedAt, node.finishedAt)).filter((value) => value > 0)
  if (!durations.length) return 0
  return round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
}

export function calcOverdueCount(records: Array<{ status?: string; handoverAt?: string; inboundAt?: string; updatedAt?: string; createdAt?: string }>, hours = 48): number {
  const now = Date.now()
  return records.filter((record) => {
    if (record.status === '已回写' || record.status === '已关闭') return false
    const startAt = parseTime(record.handoverAt || record.inboundAt || record.updatedAt || record.createdAt)
    return startAt > 0 && now - startAt > hours * 60 * 60 * 1000
  }).length
}

function statusRows(counts: Record<string, number>): StatusCountRow[] {
  return Object.entries(counts).map(([label, count]) => ({ label, count }))
}

function buildFactoryRows(orders: ProcessWorkOrder[], handovers: ProcessHandoverRecord[], differences: ProcessHandoverDifferenceRecord[]): FactoryMetricRow[] {
  const rows = new Map<string, FactoryMetricRow>()
  orders.forEach((order) => {
    const existing = rows.get(order.factoryId) || {
      factoryId: order.factoryId,
      factoryName: order.factoryName,
      workOrderCount: 0,
      plannedQty: 0,
      doneQty: 0,
      handoverQty: 0,
      diffQty: 0,
      completionRate: 0,
    }
    existing.workOrderCount += 1
    existing.plannedQty += order.plannedQty
    order.executionNodes.forEach((node) => {
      existing.doneQty += getNodeQty(node)
    })
    rows.set(order.factoryId, existing)
  })
  handovers.forEach((record) => {
    const existing = rows.get(record.handoverFactoryId) || {
      factoryId: record.handoverFactoryId,
      factoryName: record.handoverFactoryName,
      workOrderCount: 0,
      plannedQty: 0,
      doneQty: 0,
      handoverQty: 0,
      diffQty: 0,
      completionRate: 0,
    }
    existing.handoverQty += record.handoverObjectQty
    rows.set(record.handoverFactoryId, existing)
  })
  differences.forEach((record) => {
    const order = orders.find((item) => item.workOrderId === record.sourceWorkOrderId)
    const factoryId = order?.factoryId || record.sourceWorkOrderId
    const existing = rows.get(factoryId) || {
      factoryId,
      factoryName: order?.factoryName || record.craftName,
      workOrderCount: 0,
      plannedQty: 0,
      doneQty: 0,
      handoverQty: 0,
      diffQty: 0,
      completionRate: 0,
    }
    existing.diffQty += Math.abs(record.diffObjectQty)
    rows.set(factoryId, existing)
  })
  return Array.from(rows.values()).map((row) => ({
    ...row,
    plannedQty: round(row.plannedQty),
    doneQty: round(row.doneQty),
    handoverQty: round(row.handoverQty),
    diffQty: round(row.diffQty),
    completionRate: calcCompletionRate(row.doneQty, row.plannedQty),
  }))
}

function buildBaseStatistics(
  orders: ProcessWorkOrder[],
  records: ReturnType<typeof filterWarehouseRecords>,
): BaseExecutionStatistics {
  const handovers = records.handovers
  const reviews = records.reviews
  const differences = records.differences
  return {
    workOrderCount: orders.length,
    statusCounts: countByStatus(orders),
    statusRows: statusRows(countByStatus(orders)),
    factoryRows: buildFactoryRows(orders, handovers, differences),
    waitProcessRecordCount: records.waitProcess.length,
    waitHandoverRecordCount: records.waitHandover.length,
    partialHandoverRecordCount: records.waitHandover.filter((record) => record.status === '已部分交出').length,
    waitWritebackHandoverCount: handovers.filter((record) => record.status === '待回写').length,
    writtenBackHandoverCount: handovers.filter((record) => record.status === '已回写').length,
    differenceHandoverCount: handovers.filter((record) => ['有差异', '平台处理中', '需重新交出'].includes(record.status)).length,
    differenceRecordCount: differences.length,
    pendingDifferenceRecordCount: differences.filter((record) => record.status === '待处理' || record.status === '处理中').length,
    reworkDifferenceRecordCount: differences.filter((record) => record.status === '需重新交出').length,
    platformProcessingDifferenceRecordCount: differences.filter((record) => record.status === '处理中').length,
    waitReviewCount: reviews.filter((record) => record.reviewStatus === '待审核' || record.reviewStatus === '数量差异').length,
    reviewPassCount: reviews.filter((record) => record.reviewStatus === '审核通过').length,
    reviewRejectCount: reviews.filter((record) => record.reviewStatus === '审核驳回').length,
    handoverAverageWritebackHours: calcAverageDuration(handovers.map((record) => ({ startedAt: record.handoverAt, finishedAt: record.receiveAt }))),
    overdueWritebackCount: calcOverdueCount(handovers.filter((record) => record.status === '待回写')),
  }
}

function nodeQty(
  orders: ProcessWorkOrder[],
  nodeNames: string[],
  qtyKeys: Array<'outputQty' | 'actualCompletedQty' | 'usedMaterialQty'> = ['outputQty', 'actualCompletedQty'],
  nodeCodes: string[] = [],
): number {
  return round(orders.reduce((sum, order) => sum + order.executionNodes
    .filter((node) => nodeNames.includes(node.nodeName) || nodeCodes.includes(String((node as { nodeCode?: string }).nodeCode || '')))
    .reduce((nodeSum, node) => {
      const item = node as { outputQty?: number; actualCompletedQty?: number; usedMaterialQty?: number }
      const qty = qtyKeys.map((key) => item[key]).find((value) => typeof value === 'number')
      return nodeSum + Number(qty || 0)
    }, 0), 0))
}

function averageNodeHours(orders: ProcessWorkOrder[], nodeNames: string[], nodeCodes: string[] = []): number {
  return calcAverageDuration(orders.flatMap((order) => order.executionNodes.filter((node) =>
    nodeNames.includes(node.nodeName) || nodeCodes.includes(String((node as { nodeCode?: string }).nodeCode || '')),
  )))
}

export function getPrintingExecutionStatistics(filter: ProcessStatisticsFilter = {}): PrintingExecutionStatistics {
  const orders = filterProcessOrders('PRINT', filter)
  const records = filterWarehouseRecords('PRINT', filter)
  const base = buildBaseStatistics(orders, records)
  return {
    ...base,
    plannedPrintFabricMeters: round(orders.reduce((sum, order) => sum + order.plannedQty, 0)),
    printCompletedFabricMeters: nodeQty(orders, ['打印']),
    transferCompletedFabricMeters: nodeQty(orders, ['转印'], ['actualCompletedQty', 'outputQty']),
    waitProcessFabricMeters: sumWarehouseQty(records.waitProcess, '面料', 'availableObjectQty'),
    waitHandoverFabricMeters: sumWarehouseQty(records.waitHandover, '面料', 'availableObjectQty'),
    handedOverFabricMeters: sumHandoverQty(records.handovers, '面料', 'handoverObjectQty'),
    receivedFabricMeters: sumHandoverQty(records.handovers, '面料', 'receiveObjectQty'),
    diffFabricMeters: sumHandoverQty(records.handovers, '面料', 'diffObjectQty'),
    usedMaterialMeters: nodeQty(orders, ['转印'], ['usedMaterialQty']),
    printAverageHours: averageNodeHours(orders, ['打印']),
    transferAverageHours: averageNodeHours(orders, ['转印']),
  }
}

export function getPrintingDashboardMetrics(filter: ProcessStatisticsFilter = {}): DashboardMetrics<PrintingExecutionStatistics> {
  const statistics = getPrintingExecutionStatistics(filter)
  return {
    statistics,
    statusRows: statistics.statusRows,
    factoryRows: statistics.factoryRows,
  }
}

export function getDyeingExecutionStatistics(filter: ProcessStatisticsFilter = {}): DyeingExecutionStatistics {
  const orders = filterProcessOrders('DYE', filter)
  const records = filterWarehouseRecords('DYE', filter)
  const base = buildBaseStatistics(orders, records)
  const schedules = listDyeVatSchedules().filter((schedule) => orders.some((order) => order.workOrderId === schedule.dyeOrderId))
  return {
    ...base,
    plannedDyeFabricMeters: round(orders.reduce((sum, order) => sum + order.plannedQty, 0)),
    materialReadyFabricMeters: nodeQty(orders, ['备料']),
    dyeCompletedFabricMeters: nodeQty(orders, ['染色']),
    finalPackedFabricMeters: nodeQty(orders, [], ['outputQty', 'actualCompletedQty'], ['PACK']),
    waitProcessFabricMeters: sumWarehouseQty(records.waitProcess, '面料', 'availableObjectQty'),
    waitHandoverFabricMeters: sumWarehouseQty(records.waitHandover, '面料', 'availableObjectQty'),
    handedOverFabricMeters: sumHandoverQty(records.handovers, '面料', 'handoverObjectQty'),
    receivedFabricMeters: sumHandoverQty(records.handovers, '面料', 'receiveObjectQty'),
    diffFabricMeters: sumHandoverQty(records.handovers, '面料', 'diffObjectQty'),
    currentVatScheduleCount: schedules.filter((schedule) => schedule.status === 'PLANNED' || schedule.status === 'IN_USE').length,
    dyeAverageHours: averageNodeHours(orders, ['染色']),
    dehydrateAverageHours: averageNodeHours(orders, ['脱水']),
    dryAverageHours: averageNodeHours(orders, ['烘干']),
    setAverageHours: averageNodeHours(orders, ['定型']),
    rollAverageHours: averageNodeHours(orders, ['打卷']),
    packAverageHours: averageNodeHours(orders, [], ['PACK']),
  }
}

export function getDyeingDashboardMetrics(filter: ProcessStatisticsFilter = {}): DashboardMetrics<DyeingExecutionStatistics> {
  const statistics = getDyeingExecutionStatistics(filter)
  return {
    statistics,
    statusRows: statistics.statusRows,
    factoryRows: statistics.factoryRows,
  }
}

export function getSpecialCraftExecutionStatistics(filter: ProcessStatisticsFilter = {}): SpecialCraftExecutionStatistics {
  const taskOrders = (filter.craftName
    ? getSpecialCraftTaskOrders(undefined).filter((order) => order.operationName === filter.craftName)
    : listSpecialCraftTaskOrders())
    .filter((order) => (!filter.factoryId || order.factoryId === filter.factoryId) && (!filter.workOrderId || order.taskOrderId === filter.workOrderId))
  const records = filterWarehouseRecords('SPECIAL_CRAFT', filter)
  const fakeOrders: ProcessWorkOrder[] = taskOrders.map((order) => ({
    workOrderId: order.taskOrderId,
    workOrderNo: order.taskOrderNo,
    processType: 'PRINT',
    sourceDemandIds: [order.productionOrderId],
    productionOrderIds: [order.productionOrderNo],
    factoryId: order.factoryId,
    factoryName: order.factoryName,
    plannedQty: order.planQty,
    plannedUnit: '片',
    materialSku: order.materialSku || order.partName,
    materialName: order.partName,
    materialBatchNos: [],
    status: order.status as never,
    statusLabel: order.status,
    taskId: order.sourceTaskId,
    taskNo: order.taskOrderNo,
    taskQrValue: '',
    executionNodes: [],
    reviewRecords: [],
    handoverRecords: [],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }))
  const base = buildBaseStatistics(fakeOrders, records)
  const bindings = listCuttingSpecialCraftFeiTicketBindings().filter((binding) =>
    (!filter.craftName || binding.operationName === filter.craftName)
    && taskOrders.some((order) => order.taskOrderId === binding.taskOrderId),
  )
  const qtyReports = listSpecialCraftQtyDifferenceReports().filter((report) =>
    (!filter.craftName || report.operationName === filter.craftName)
    && taskOrders.some((order) => order.taskOrderId === report.taskOrderId),
  )
  const differences = records.differences
  return {
    ...base,
    taskOrderCount: taskOrders.length,
    craftRows: statusRows(taskOrders.reduce<Record<string, number>>((result, order) => {
      result[order.operationName] = (result[order.operationName] || 0) + 1
      return result
    }, {})),
    waitProcessPieceQty: sumWarehouseQty(records.waitProcess, '裁片', 'availableObjectQty'),
    receivedPieceQty: round(taskOrders.reduce((sum, order) => sum + order.receivedQty, 0)),
    completedPieceQty: round(taskOrders.reduce((sum, order) => sum + order.completedQty, 0)),
    waitHandoverPieceQty: sumWarehouseQty(records.waitHandover, '裁片', 'availableObjectQty'),
    handedOverPieceQty: sumHandoverQty(records.handovers, '裁片', 'handoverObjectQty'),
    receivedHandoverPieceQty: sumHandoverQty(records.handovers, '裁片', 'receiveObjectQty'),
    diffPieceQty: sumHandoverQty(records.handovers, '裁片', 'diffObjectQty'),
    currentPieceQty: round(bindings.reduce((sum, binding) => sum + binding.currentQty, 0)),
    scrapPieceQty: round(bindings.reduce((sum, binding) => sum + (binding.cumulativeScrapQty || binding.scrapQty || 0), 0) + qtyReports.filter((report) => report.differenceType === '报废').reduce((sum, report) => sum + Math.abs(report.differenceQty), 0)),
    damagePieceQty: round(bindings.reduce((sum, binding) => sum + (binding.cumulativeDamageQty || binding.damageQty || 0), 0) + qtyReports.filter((report) => report.differenceType === '货损').reduce((sum, report) => sum + Math.abs(report.differenceQty), 0)),
    feiTicketCount: new Set(bindings.map((binding) => binding.feiTicketNo)).size,
    waitProcessFeiTicketCount: bindings.filter((binding) => binding.specialCraftFlowStatus === '已接收' || binding.specialCraftFlowStatus === '加工中').length,
    completedFeiTicketCount: bindings.filter((binding) => binding.specialCraftFlowStatus === '待回仓' || binding.specialCraftFlowStatus === '已回仓').length,
    differenceFeiTicketCount: bindings.filter((binding) => binding.receiveDifferenceStatus || binding.returnDifferenceStatus || binding.differenceQty).length,
    scrapFeiTicketCount: bindings.filter((binding) => (binding.scrapQty || 0) > 0).length,
    damageFeiTicketCount: bindings.filter((binding) => (binding.damageQty || 0) > 0).length,
    lessReceivePieceQty: round(differences.filter((record) => record.differenceType === '少收').reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
    moreReceivePieceQty: round(differences.filter((record) => record.differenceType === '多收').reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
    averageProcessHours: calcAverageDuration(taskOrders.flatMap((order) => order.nodeRecords.map((record) => ({ startedAt: record.operatedAt, finishedAt: record.operatedAt })))),
  }
}

export function getSpecialCraftDashboardMetrics(filter: ProcessStatisticsFilter = {}): DashboardMetrics<SpecialCraftExecutionStatistics> {
  const statistics = getSpecialCraftExecutionStatistics(filter)
  return {
    statistics,
    statusRows: statistics.statusRows,
    factoryRows: statistics.factoryRows,
  }
}

function actionRecordsHours(records: PostFinishingActionRecord[]): number {
  return calcAverageDuration(records.filter((record) => record.startedAt && record.finishedAt))
}

function postStatusCount(orders: PostFinishingWorkOrder[], status: string): number {
  return orders.filter((order) => order.currentStatus === status).length
}

export function getPostFinishingExecutionStatistics(filter: ProcessStatisticsFilter = {}): PostFinishingExecutionStatistics {
  const postOrders = listPostFinishingWorkOrders().filter((order) =>
    (!filter.factoryId || order.currentFactoryId === filter.factoryId || order.managedPostFactoryId === filter.factoryId)
    && (!filter.workOrderId || order.postOrderId === filter.workOrderId),
  )
  const records = filterWarehouseRecords('POST_FINISHING', filter)
  const base = buildBaseStatistics([], records)
  const waitProcess = records.waitProcess
  const dedicatedOrders = postOrders.filter((order) => order.routeMode === '专门后道工厂完整流程')
  const transferOrders = postOrders.filter((order) => order.routeMode === '车缝厂已做后道')
  const receiveRecords = listPostFinishingActionRecords('接收领料').filter((record) => postOrders.some((order) => order.postOrderId === record.postOrderId))
  const qcRecords = listPostFinishingQcOrders().filter((record) => postOrders.some((order) => order.postOrderId === record.postOrderId))
  const recheckRecords = listPostFinishingRecheckOrders().filter((record) => postOrders.some((order) => order.postOrderId === record.postOrderId))
  const postRecords = listPostFinishingActionRecords('后道').filter((record) => postOrders.some((order) => order.postOrderId === record.postOrderId))
  const lessDifferences = records.differences.filter((record) => record.differenceType === '少收')
  const moreDifferences = records.differences.filter((record) => record.differenceType === '多收')
  return {
    ...base,
    workOrderCount: postOrders.length,
    statusCounts: countByStatus(postOrders),
    statusRows: statusRows(countByStatus(postOrders)),
    postOrderCount: postOrders.length,
    waitReceiveTaskCount: postOrders.filter((order) => order.currentStatus === '待接收领料' || order.currentStatus === '接收中').length,
    receiveDoneGarmentQty: round(receiveRecords.reduce((sum, record) => sum + record.acceptedGarmentQty, 0)),
    receiveDiffGarmentQty: round(receiveRecords.reduce((sum, record) => sum + record.diffGarmentQty, 0)),
    waitPostTaskCount: postStatusCount(postOrders, '待后道'),
    postDoingTaskCount: postStatusCount(postOrders, '后道中'),
    postDoneTaskCount: postStatusCount(postOrders, '后道完成'),
    waitQcTaskCount: postStatusCount(postOrders, '待质检'),
    qcDoingTaskCount: postStatusCount(postOrders, '质检中'),
    qcDoneTaskCount: postStatusCount(postOrders, '质检完成'),
    waitRecheckTaskCount: postStatusCount(postOrders, '待复检'),
    recheckDoingTaskCount: postStatusCount(postOrders, '复检中'),
    recheckDoneTaskCount: postStatusCount(postOrders, '复检完成'),
    waitHandoverTaskCount: postStatusCount(postOrders, '待交出'),
    handedOverTaskCount: postStatusCount(postOrders, '已交出'),
    completedTaskCount: postStatusCount(postOrders, '已完成') + postStatusCount(postOrders, '已回写'),
    waitPostGarmentQty: sumWarehouseQty(waitProcess.filter((record) => record.currentActionName === '待后道'), '成衣', 'availableObjectQty'),
    postDoneGarmentQty: round(postRecords.reduce((sum, record) => sum + record.submittedGarmentQty, 0)),
    waitQcGarmentQty: sumWarehouseQty(waitProcess.filter((record) => record.currentActionName === '待质检'), '成衣', 'availableObjectQty'),
    qcPassGarmentQty: round(qcRecords.reduce((sum, record) => sum + record.acceptedGarmentQty, 0)),
    qcRejectedGarmentQty: round(qcRecords.reduce((sum, record) => sum + record.rejectedGarmentQty, 0)),
    waitRecheckGarmentQty: sumWarehouseQty(waitProcess.filter((record) => record.currentActionName === '待复检'), '成衣', 'availableObjectQty'),
    recheckConfirmedGarmentQty: round(recheckRecords.reduce((sum, record) => sum + record.acceptedGarmentQty, 0)),
    waitHandoverGarmentQty: sumWarehouseQty(records.waitHandover, '成衣', 'availableObjectQty'),
    handedOverGarmentQty: sumHandoverQty(records.handovers, '成衣', 'handoverObjectQty'),
    receivedGarmentQty: sumHandoverQty(records.handovers, '成衣', 'receiveObjectQty'),
    diffGarmentQty: sumHandoverQty(records.handovers, '成衣', 'diffObjectQty'),
    dedicatedTaskCount: dedicatedOrders.length,
    postFactoryExecutedTaskCount: dedicatedOrders.length,
    sewingFactoryPostDoneTaskCount: transferOrders.length,
    dedicatedWaitQcGarmentQty: round(dedicatedOrders.filter((order) => order.currentStatus === '待质检').reduce((sum, order) => sum + order.plannedGarmentQty, 0)),
    dedicatedWaitRecheckGarmentQty: round(dedicatedOrders.filter((order) => order.currentStatus === '待复检').reduce((sum, order) => sum + order.plannedGarmentQty, 0)),
    transferWaitManagedFactoryTaskCount: transferOrders.filter((order) => order.currentStatus.includes('待交后道工厂') || order.currentStatus.includes('已交后道工厂')).length,
    transferInWaitQcGarmentQty: round(transferOrders.filter((order) => order.currentStatus.includes('待质检')).reduce((sum, order) => sum + order.plannedGarmentQty, 0)),
    transferInWaitRecheckGarmentQty: round(transferOrders.filter((order) => order.currentStatus.includes('待复检') || order.currentStatus.includes('复检')).reduce((sum, order) => sum + order.plannedGarmentQty, 0)),
    lessReceiveGarmentQty: round(lessDifferences.reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
    moreReceiveGarmentQty: round(moreDifferences.reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
    postAverageHours: actionRecordsHours(postRecords),
    qcAverageHours: actionRecordsHours(qcRecords),
    recheckAverageHours: actionRecordsHours(recheckRecords),
  }
}

export function getPostFinishingDashboardMetrics(filter: ProcessStatisticsFilter = {}): DashboardMetrics<PostFinishingExecutionStatistics> {
  const statistics = getPostFinishingExecutionStatistics(filter)
  return {
    statistics,
    statusRows: statistics.statusRows,
    factoryRows: statistics.factoryRows,
  }
}
