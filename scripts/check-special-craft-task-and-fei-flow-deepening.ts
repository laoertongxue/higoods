#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getSpecialCraftBindingSummaryByTaskOrderId,
  getCuttingSpecialCraftReturnStatusByProductionOrder,
  getSpecialCraftFeiTicketScanSummary,
  listCuttingSpecialCraftFeiTicketBindings,
  listSpecialCraftQtyDifferenceReports,
} from '../src/data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  listSpecialCraftTaskOrders,
  listSpecialCraftTaskWorkOrders,
  listSpecialCraftTaskWorkOrderLines,
} from '../src/data/fcs/special-craft-task-orders.ts'
import { listEnabledSpecialCraftOperationDefinitions } from '../src/data/fcs/special-craft-operations.ts'
import { getEligibleFeiTicketsForSewingDispatch } from '../src/data/fcs/cutting/sewing-dispatch.ts'
import {
  renderSpecialCraftWaitHandoverWarehousePage,
  renderSpecialCraftWaitProcessWarehousePage,
} from '../src/pages/process-factory/special-craft/warehouse.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function token(...parts: string[]): string {
  return parts.join('')
}

const packageSource = read('package.json')
const taskOrdersSource = read('src/data/fcs/special-craft-task-orders.ts')
const generationSource = read('src/data/fcs/special-craft-task-generation.ts')
const flowSource = read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts')
const sewingDispatchSource = read('src/data/fcs/cutting/sewing-dispatch.ts')
const progressSource = read('src/data/fcs/progress-statistics-linkage.ts')
const taskOrdersPageSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const taskDetailPageSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const warehousePageSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const sharedPageSource = read('src/pages/process-factory/special-craft/shared.ts')
const workOrderDetailPageSource = read('src/pages/process-factory/special-craft/work-order-detail.ts')
const statisticsPageSource = read('src/pages/process-factory/special-craft/statistics.ts')
const dispatchPageSource = read('src/pages/process-factory/cutting/special-craft-dispatch.ts')
const returnPageSource = read('src/pages/process-factory/cutting/special-craft-return.ts')
const feiTicketsPageSource = read('src/pages/process-factory/cutting/fei-tickets.ts')
const pdaExecSource = read('src/pages/pda-exec-detail.ts')
const pdaHandoverSource = read('src/pages/pda-handover-detail.ts')
const pdaWarehouseSource = [
  read('src/pages/pda-warehouse-wait-process.ts'),
  read('src/pages/pda-warehouse-wait-handover.ts'),
  read('src/pages/pda-warehouse-inbound-records.ts'),
  read('src/pages/pda-warehouse-outbound-records.ts'),
].join('\n')

assertContains(packageSource, 'check:special-craft-task-and-fei-flow-deepening', 'package.json 缺少深化检查命令')

;[
  'export interface SpecialCraftTaskOrder',
  'export interface SpecialCraftTaskWorkOrder',
  'export interface SpecialCraftTaskWorkOrderLine',
  'buildSpecialCraftTaskWorkOrders',
  'listSpecialCraftTaskWorkOrders',
  'syncSpecialCraftTaskOrderAggregatesFromWorkOrders',
].forEach((item) => assertContains(taskOrdersSource, item, `特殊工艺任务缺少父子工艺单能力：${item}`))

assertContains(generationSource, 'getSpecialCraftGenerationKey', '父任务幂等键必须保留')
assertContains(generationSource, 'targetObject', '父任务仍需按作用对象合并')
assertContains(generationSource, "'WAIT_ASSIGN'", '父任务仍需保留待分配占位合并口径')
assertContains(taskOrdersSource, 'partName', '子工艺单必须按裁片部位拆分')
assertContains(taskOrdersSource, 'factoryId ||', '子工艺单必须按执行工厂或待分配占位拆分')

;[
  'workOrderId',
  'workOrderNo',
  'originalQty',
  'openingQty',
  'receivedQty',
  'scrapQty',
  'damageQty',
  'closingQty',
  'returnedQty',
  'currentQty',
  'cumulativeScrapQty',
  'cumulativeDamageQty',
].forEach((item) => assertContains(flowSource + taskOrdersSource, item, `菲票流转缺少数量字段：${item}`))

;[
  'export interface SpecialCraftQtyDifferenceReport',
  'reportPhase',
  '接收差异',
  '回仓差异',
  'platformStatus',
  'reportedAt',
  'reportedBy',
  'resolvedAt',
  'createQtyDifferenceReport',
].forEach((item) => assertContains(flowSource, ` ${item}`.trim(), `缺少特殊工艺数量差异上报：${item}`))

;[
  "specialCraftFlowStatus: '已接收'",
  'receiveDifferenceStatus: report.platformStatus',
  "specialCraftFlowStatus: '已回仓'",
  'returnDifferenceStatus: report.platformStatus',
  '差异待处理不阻断',
].forEach((item) => assertContains(flowSource + sewingDispatchSource, item, `差异上报不能覆盖主流程状态：${item}`))

;[
  'recomputeSequenceGate',
  "previous.specialCraftFlowStatus === '已回仓'",
  "previous.currentLocation === '裁床厂待交出仓'",
  'previous.currentQty > 0',
  '等待前一道回仓',
  "'待确认顺序'",
].forEach((item) => assertContains(flowSource, item, `多道特殊工艺顺序缺少约束：${item}`))

;[
  'getSpecialCraftFeiTicketScanSummary',
  'hasSpecialCraft',
  'completedOperationNames',
  'currentOperationName',
  'nextOperationName',
  'cumulativeScrapQty',
  'cumulativeDamageQty',
  'blockingReason',
].forEach((item) => assertContains(flowSource, item, `扫菲票结果缺少字段：${item}`))

assertContains(dispatchPageSource + returnPageSource + pdaHandoverSource, 'getSpecialCraftFeiTicketScanSummary', '扫描和交接页面必须复用统一菲票结果')
assertContains(feiTicketsPageSource, '已完成特殊工艺', '裁床菲票页面必须展示已完成特殊工艺')
assertContains(feiTicketsPageSource, '原数量', '裁床菲票页面必须展示原数量')
assertContains(feiTicketsPageSource, '当前数量', '裁床菲票页面必须展示当前数量')
assertContains(feiTicketsPageSource, '累计报废', '裁床菲票页面必须展示累计报废')
assertContains(feiTicketsPageSource, '累计货损', '裁床菲票页面必须展示累计货损')

;[
  '子工艺单',
  '差异上报',
  '接收差异上报',
  '回仓差异上报',
].forEach((item) => assertContains(taskDetailPageSource, item, `任务详情缺少深化区块：${item}`))
assertContains(taskOrdersPageSource, '打印任务流转卡', '特殊工艺任务单列表缺少打印任务流转卡入口')
assertContains(taskOrdersPageSource, "buildTaskRouteCardPrintLink('SPECIAL_CRAFT_TASK_ORDER', taskOrder.taskOrderId)", '特殊工艺任务单列表打印必须使用 taskOrderId')
assertContains(taskDetailPageSource, '打印任务流转卡', '特殊工艺任务详情缺少打印任务流转卡入口')
assertContains(taskDetailPageSource, "buildTaskRouteCardPrintLink('SPECIAL_CRAFT_TASK_ORDER', taskOrder.taskOrderId)", '特殊工艺任务详情打印必须使用 taskOrderId')
assertContains(sharedPageSource, "'wait-process'", '特殊工艺 shared 子导航缺少待加工仓')
assertContains(sharedPageSource, "'wait-handover'", '特殊工艺 shared 子导航缺少待交出仓')
assertContains(warehousePageSource, 'renderSpecialCraftWaitHandoverWarehousePage', '特殊工艺缺少待交出仓页面')
assertContains(warehousePageSource, '出库记录', '特殊工艺待交出仓页缺少出库记录')
assertContains(warehousePageSource, '打印任务交货卡', '特殊工艺待交出仓出库记录缺少打印任务交货卡入口')
assertContains(warehousePageSource, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '特殊工艺仓库任务交货卡必须使用 handoverRecordId')
const sampleOperation =
  listEnabledSpecialCraftOperationDefinitions().find((operation) =>
    renderSpecialCraftWaitHandoverWarehousePage(operation.operationId).includes('打印任务交货卡'),
  ) || listEnabledSpecialCraftOperationDefinitions()[0]
assert(sampleOperation, '缺少特殊工艺菜单样例')
assertNotContains(renderSpecialCraftWaitProcessWarehousePage(sampleOperation.operationId), '打印任务交货卡', '特殊工艺待加工仓不得出现打印任务交货卡')
assertContains(renderSpecialCraftWaitHandoverWarehousePage(sampleOperation.operationId), '打印任务交货卡', '特殊工艺待交出仓渲染结果缺少打印任务交货卡')
assertContains(workOrderDetailPageSource, '工艺单详情', '缺少子工艺单详情页')
assertContains(workOrderDetailPageSource, '流转事件', '子工艺单详情必须展示流转事件')

;[
  '子工艺单数',
  '当前数量',
  '累计报废',
  '累计货损',
  '接收差异菲票数',
  '回仓差异菲票数',
].forEach((item) => assertContains(taskOrdersPageSource, item, `父任务列表缺少聚合字段：${item}`))

;[
  '报废数量',
  '货损数量',
  '完工后数量',
  'linkSpecialCraftCompletionToReturnWaitHandoverStock',
  '绑定菲票',
  '原数量',
  '当前数量',
].forEach((item) => assertContains(pdaExecSource, item, `执行详情缺少特殊工艺完工字段：${item}`))

;[
  '差异状态',
  '报废数量',
  '货损数量',
  '原数量',
  '当前数量',
  '已完成特殊工艺',
].forEach((item) => assertContains(pdaHandoverSource + pdaWarehouseSource, item, `交接或仓管缺少特殊工艺数量展示：${item}`))

;[
  '默认按工艺分组',
  "groupBy: '工艺'",
  '接收差异菲票',
  '回仓差异菲票',
  '累计报废裁片数量',
  '累计货损裁片数量',
  '当前裁片数量',
].forEach((item) => assertContains(statisticsPageSource + progressSource, item, `特殊工艺统计缺少深化字段：${item}`))
assertNotContains(statisticsPageSource + progressSource, '水洗批次', '洗水统计不得新增水洗批次维度')
if (taskOrdersSource.includes('bundleWidthCm') || taskOrdersSource.includes('stripCount')) {
  assertContains(statisticsPageSource + progressSource + taskOrdersSource, 'bundleWidthCm', '捆条宽度源字段存在时统计消费位必须保留')
}

assertContains(sewingDispatchSource, 'currentQty > 0', '已回仓裁片发车缝仍需 currentQty > 0')
assertContains(sewingDispatchSource, "summary.returnStatus.includes('已回仓')", '发车缝必须按回仓结果判断特殊工艺状态')
assertContains(sewingDispatchSource, '差异待处理不阻断裁片统一发料', '特殊工艺差异待处理不得直接阻断发车缝')

assertNotContains(flowSource, "specialCraftFlowStatus: '差异'", '特殊工艺差异不应覆盖主流程状态')
assertNotContains(flowSource, "specialCraftFlowStatus: '异议中'", '特殊工艺异议不应覆盖主流程状态')
assertNotContains(flowSource, '子菲票', '本 step 不得生成子菲票')
assertNotContains(flowSource, 'splitFeiTicket', '本 step 不得拆菲票')
assertNotContains(flowSource, "specialCraftFlowStatus: 'VOIDED'", '特殊工艺损耗不得做成 VOIDED')
assertNotContains(flowSource, token('报废', '作废'), '特殊工艺报废不得等于菲票作废')

const tasks = listSpecialCraftTaskOrders()
const workOrders = listSpecialCraftTaskWorkOrders()
const workOrderLines = listSpecialCraftTaskWorkOrderLines()
const bindings = listCuttingSpecialCraftFeiTicketBindings()
assert(tasks.length > 0, '必须保留特殊工艺父任务数据')
assert(workOrders.length > 0, '必须生成子工艺单数据')
assert(workOrderLines.length > 0, '必须生成子工艺单明细')
assert(workOrders.every((item) => item.taskOrderId && item.partName), '子工艺单必须关联父任务和裁片部位')
assert(bindings.length > 0, '必须保留特殊工艺菲票绑定')
assert(bindings.every((item) => item.workOrderId && item.workOrderLineId), '菲票绑定必须关联子工艺单和子工艺单明细')
assert(bindings.every((item) => item.originalQty >= item.currentQty && item.currentQty >= 0), '菲票数量变化必须保留原数量与当前数量')

const sampleBinding = bindings[0]
const scanSummary = getSpecialCraftFeiTicketScanSummary(sampleBinding.feiTicketNo)
assert(scanSummary.hasSpecialCraft, '扫菲票结果必须识别特殊工艺')
assert(scanSummary.originalQty >= scanSummary.currentQty, '扫菲票结果必须包含原数量和当前数量')
assert(Array.isArray(scanSummary.completedOperationNames), '扫菲票结果必须包含已完成特殊工艺')

const parentSummary = getSpecialCraftBindingSummaryByTaskOrderId(sampleBinding.taskOrderId)
assert(parentSummary.childWorkOrderCount > 0, '父任务聚合必须包含子工艺单数')
assert('cumulativeScrapQty' in parentSummary && 'cumulativeDamageQty' in parentSummary, '父任务聚合必须包含报废和货损')
assert(Array.isArray(listSpecialCraftQtyDifferenceReports()), '必须提供差异上报列表')

const returnStatus = getCuttingSpecialCraftReturnStatusByProductionOrder(sampleBinding.productionOrderId)
assert(typeof returnStatus.allReturned === 'boolean', '特殊工艺回仓状态必须输出 allReturned')
const eligible = getEligibleFeiTicketsForSewingDispatch({ productionOrderId: sampleBinding.productionOrderId })
assert(eligible.every((item) => item.qty > 0), '可发车缝菲票必须保留正数当前数量')

;[
  token('axi', 'os'),
  token('fet', 'ch('),
  token('api', 'Client'),
  token('/', 'api', '/'),
  token('i1', '8n'),
  token('use', 'Translation'),
  token('loc', 'ales'),
  token('trans', 'lations'),
  token('e', 'charts'),
  token('chart', '.', 'js'),
  token('re', 'charts'),
  token('库存', '三态'),
  token('上架', '任务'),
  token('拣货', '波次'),
  token('来料', '仓'),
  token('半成品', '仓'),
].forEach((item) => {
  assertNotContains(
    [taskOrdersSource, flowSource, sewingDispatchSource, pdaExecSource, pdaHandoverSource, pdaWarehouseSource].join('\n'),
    item,
    `本 step 不得新增越界内容：${item}`,
  )
})

console.log('check:special-craft-task-and-fei-flow-deepening passed')
