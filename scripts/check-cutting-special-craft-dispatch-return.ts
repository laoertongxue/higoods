#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ensureSpecialCraftFeiTicketFlowSeeded,
  getCuttingSpecialCraftReturnStatusByProductionOrder,
  getEligibleSpecialCraftFeiTickets,
  listCuttingSpecialCraftDispatchViews,
  listCuttingSpecialCraftFeiTicketBindings,
  listCuttingSpecialCraftReturnViews,
} from '../src/data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
} from '../src/data/fcs/factory-internal-warehouse.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function resolveRepoPath(relativePath: string): string {
  return path.join(ROOT, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveRepoPath(relativePath), 'utf8')
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

const packageSource = read('package.json')
const flowSource = read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts')
const sewingDispatchSource = read('src/data/fcs/cutting/sewing-dispatch.ts') + read('src/pages/process-factory/cutting/sewing-dispatch.ts')
const progressStatisticsSource = read('src/data/fcs/progress-statistics-linkage.ts')
const cuttingMetaSource = read('src/pages/process-factory/cutting/meta.ts')
const dispatchPageSource = read('src/pages/process-factory/cutting/special-craft-dispatch.ts') + cuttingMetaSource
const returnPageSource = read('src/pages/process-factory/cutting/special-craft-return.ts') + cuttingMetaSource
const feiPageSource = read('src/pages/process-factory/cutting/fei-tickets.ts')
const progressSource = read('src/pages/process-factory/cutting/production-progress.ts')
const summarySource = read('src/pages/process-factory/cutting/cutting-summary.ts')
const specialCraftTaskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const specialCraftTaskDetailSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const specialCraftWarehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const handoverDetailSource = read('src/pages/pda-handover-detail.ts')
const handoverListSource = read('src/pages/pda-handover.ts')
const waitProcessSource = read('src/pages/pda-warehouse-wait-process.ts')
const waitHandoverSource = read('src/pages/pda-warehouse-wait-handover.ts')
const inboundSource = read('src/pages/pda-warehouse-inbound-records.ts')
const outboundSource = read('src/pages/pda-warehouse-outbound-records.ts')
const factoryWarehouseSource = read('src/pages/factory-internal-warehouse.ts')

assertContains(packageSource, 'check:cutting-special-craft-dispatch-return', 'package.json 缺少裁床特殊工艺发料与回仓检查命令')

;[
  'export interface CuttingSpecialCraftFeiTicketBinding',
  'buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets',
  'getEligibleSpecialCraftFeiTickets',
  'createSpecialCraftDispatchHandoverFromFeiTickets',
  'markSpecialCraftFactoryReceivedFromHandover',
  'linkSpecialCraftCompletionToReturnWaitHandoverStock',
  'createSpecialCraftReturnHandover',
  'receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse',
  'getCuttingSpecialCraftReturnStatusByProductionOrder',
  'assertSpecialCraftDispatchAllowed',
  'assertSpecialCraftReturnAllowed',
].forEach((token) => {
  assertContains(flowSource, token, `裁床特殊工艺菲票流转缺少：${token}`)
})

;[
  '待绑定',
  '待发料',
  '已发料',
  '已接收',
  '待回仓',
  '已回仓',
  '差异',
  '异议中',
  '待确认顺序',
].forEach((token) => {
  assertContains(flowSource + dispatchPageSource + returnPageSource, token, `特殊工艺菲票流转缺少状态：${token}`)
})

assertContains(flowSource, 'createFactoryHandoverRecord', '发料与回仓必须复用现有交出记录创建逻辑')
assertContains(flowSource, 'handoverRecordQrValue', '发料与回仓必须复用交出二维码')
assertContains(flowSource, "currentLocation: differenceQty !== 0 ? '差异待处理' : '裁床厂待交出仓'", '特殊工艺回仓后必须进入裁床厂待交出仓')
assertContains(flowSource, "currentLocation: differenceQty !== 0 ? '差异待处理' : '特殊工艺厂待加工仓'", '特殊工艺厂接收后必须进入待加工仓')
assertContains(flowSource, "currentLocation: '特殊工艺厂待交出仓'", '特殊工艺完成后必须进入特殊工艺厂待交出仓')
assertContains(flowSource, "'待确认顺序'", '多特殊工艺顺序不明确时必须标记待确认顺序')
assertContains(flowSource, 'previous.specialCraftFlowStatus === \'已回仓\'', '多特殊工艺必须等待前一道已回仓后才能继续')

;[
  'CuttingSpecialCraftDispatchOrder',
  'CuttingSpecialCraftReturnOrder',
  '特殊工艺发料单',
  '特殊工艺回仓单',
  'SpecialCraftPickupOrder',
  'SpecialCraftHandoverOrder',
].forEach((token) => {
  assertNotContains(flowSource + dispatchPageSource + returnPageSource, token, `不应新增主模型：${token}`)
})

;[
  buildToken('特殊工艺', '发料'),
  buildToken('扫', '菲票加入本次发料'),
  buildToken('创建', '交出记录'),
  buildToken('查看', '任务'),
  buildToken('查看', '交出记录'),
].forEach((token) => {
  assertContains(dispatchPageSource, token, `特殊工艺发料页面缺少：${token}`)
})

;[
  buildToken('特殊工艺', '回仓'),
  buildToken('扫', '菲票确认回仓'),
  buildToken('查看', '回仓记录'),
  buildToken('查看', '差异'),
  buildToken('查看', '异议'),
].forEach((token) => {
  assertContains(returnPageSource, token, `特殊工艺回仓页面缺少：${token}`)
})

;[
  buildToken('关联', '菲票数'),
  buildToken('已发料', '菲票数'),
  buildToken('已回仓', '菲票数'),
  buildToken('回仓状态'),
].forEach((token) => {
  assertContains(specialCraftTaskOrdersSource, token, `特殊工艺任务单列表缺少：${token}`)
})

;[
  buildToken('菲票', '流转'),
  buildToken('发料', '交出记录'),
  buildToken('回仓', '交出记录'),
  buildToken('发料状态'),
  buildToken('回仓状态'),
].forEach((token) => {
  assertContains(specialCraftTaskDetailSource, token, `特殊工艺任务详情缺少：${token}`)
})

;[
  buildToken('待加工仓'),
  buildToken('待交出仓'),
  buildToken('入库记录'),
  buildToken('出库记录'),
  buildToken('回仓状态'),
  buildToken('当前所在'),
].forEach((token) => {
  assertContains(specialCraftWarehouseSource, token, `特殊工艺仓库管理缺少：${token}`)
})

;[
  buildToken('是否需要特殊工艺'),
  buildToken('特殊工艺'),
  buildToken('特殊工艺任务'),
  buildToken('发料状态'),
  buildToken('回仓状态'),
  buildToken('当前所在'),
].forEach((token) => {
  assertContains(feiPageSource, token, `裁床菲票页面缺少特殊工艺状态展示：${token}`)
})

;[
  buildToken('需要特殊工艺菲票数'),
  buildToken('待发料菲票数'),
  buildToken('已发料菲票数'),
  buildToken('已接收菲票数'),
  buildToken('待回仓菲票数'),
  buildToken('已回仓菲票数'),
  buildToken('差异菲票数'),
  buildToken('异议中菲票数'),
  buildToken('是否全部回仓'),
].forEach((token) => {
  assertContains(progressSource + summarySource, token, `裁床汇总页面缺少特殊工艺回仓状态：${token}`)
})

;[
  'markSpecialCraftFactoryReceivedFromHandover',
  'receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse',
  '已回仓',
].forEach((token) => {
  assertContains(handoverDetailSource + handoverListSource, token, `工厂端交接未复用既有交接逻辑承接特殊工艺回仓：${token}`)
})

;[
  buildToken('特殊工艺'),
  buildToken('当前所在'),
  buildToken('发料状态'),
  buildToken('回仓状态'),
].forEach((token) => {
  assertContains(waitProcessSource + waitHandoverSource + inboundSource + outboundSource, token, `工厂端仓管页面缺少特殊工艺状态展示：${token}`)
})

assertContains(factoryWarehouseSource, buildToken('待交出仓'), 'Web 工厂仓库总览缺少待交出仓口径')

;[
  buildToken('直接发', '车', '缝'),
  buildToken('直发', '车缝'),
  buildToken('直接发', '成衣', '仓'),
  buildToken('手动', '发料单'),
  buildToken('手动', '回仓'),
  buildToken('新增', '回仓单'),
  buildToken('手动', '入库'),
  buildToken('手动', '出库'),
  buildToken('新增', '库存'),
].forEach((token) => {
  assertNotContains(dispatchPageSource + returnPageSource + specialCraftWarehouseSource, token, `页面不应出现越界主流程：${token}`)
})

;[
  buildToken('P', 'DA'),
  buildToken('来', '料仓'),
  buildToken('半成品', '仓'),
  buildToken('库存', '三态'),
  buildToken('上架', '任务'),
  buildToken('拣货', '波次'),
  buildToken('库位', '规则'),
  'QR payload',
  'JSON.stringify',
].forEach((token) => {
  assertNotContains(
    dispatchPageSource +
      returnPageSource +
      feiPageSource +
      specialCraftTaskDetailSource +
      specialCraftWarehouseSource +
      waitProcessSource +
      waitHandoverSource +
      inboundSource +
      outboundSource,
    token,
    `页面用户可见文案或主流程不应出现：${token}`,
  )
})

ensureSpecialCraftFeiTicketFlowSeeded()

const bindings = listCuttingSpecialCraftFeiTicketBindings()
const dispatchViews = listCuttingSpecialCraftDispatchViews()
const returnViews = listCuttingSpecialCraftReturnViews()

assert(bindings.length > 0, '缺少裁床特殊工艺菲票绑定数据')
assert(dispatchViews.length > 0, '缺少裁床特殊工艺发料视图数据')
assert(returnViews.length > 0, '缺少裁床特殊工艺回仓视图数据')

assert(dispatchViews.some((item) => item.dispatchStatus === '待绑定'), '缺少待绑定菲票视图')
assert(dispatchViews.some((item) => item.dispatchStatus === '待发料'), '缺少待发料菲票视图')
assert(dispatchViews.some((item) => item.dispatchStatus === '已发料'), '缺少已发料菲票视图')
assert(dispatchViews.some((item) => item.dispatchStatus === '已接收'), '缺少已接收菲票视图')
assert(dispatchViews.some((item) => item.dispatchStatus === '差异'), '缺少差异菲票视图')
assert(dispatchViews.some((item) => item.dispatchStatus === '异议中'), '缺少异议中菲票视图')
assert(dispatchViews.some((item) => item.dispatchStatus === '待确认顺序'), '缺少待确认顺序菲票视图')
assert(returnViews.some((item) => item.returnStatus === '待回仓'), '缺少待回仓菲票视图')
assert(returnViews.some((item) => item.returnStatus === '已回仓'), '缺少已回仓菲票视图')
assert(returnViews.some((item) => item.returnStatus === '差异'), '缺少差异回仓视图')
assert(returnViews.some((item) => item.returnStatus === '异议中'), '缺少异议中回仓视图')

const eligibleBinding = bindings.find((item) => item.specialCraftFlowStatus === '待发料')
assert(eligibleBinding, '缺少可发料菲票样例')
const eligibleTickets = getEligibleSpecialCraftFeiTickets(eligibleBinding!.operationId)
assert(eligibleTickets.some((item) => item.feiTicketNo === eligibleBinding!.feiTicketNo), '可发料筛选未返回待发料菲票')

const receivedBinding = bindings.find((item) => item.specialCraftFlowStatus === '已接收')
assert(receivedBinding?.currentLocation === '特殊工艺厂待加工仓', '特殊工艺厂接收后应进入待加工仓')

const waitReturnBinding = bindings.find((item) => item.specialCraftFlowStatus === '待回仓')
assert(waitReturnBinding?.currentLocation === '特殊工艺厂待交出仓', '特殊工艺完成后应进入特殊工艺厂待交出仓')

const returnedBinding = bindings.find((item) => item.specialCraftFlowStatus === '已回仓')
assert(returnedBinding?.currentLocation === '裁床厂待交出仓', '特殊工艺回仓后应进入裁床厂待交出仓')

const waitProcessItems = listFactoryWaitProcessStockItems()
const waitHandoverItems = listFactoryWaitHandoverStockItems()
const inboundRecords = listFactoryWarehouseInboundRecords()
const outboundRecords = listFactoryWarehouseOutboundRecords()

assert(
  waitProcessItems.some((item) => item.feiTicketNo && item.warehouseName.includes('待加工仓')),
  '特殊工艺厂待加工仓缺少菲票接收样例',
)
assert(
  waitHandoverItems.some((item) => item.feiTicketNo && item.warehouseName.includes('待交出仓')),
  '待交出仓缺少特殊工艺回仓样例',
)
assert(
  inboundRecords.some((item) => item.feiTicketNo && item.warehouseName.includes('待加工仓')),
  '特殊工艺厂接收后缺少自动入库记录',
)
assert(
  outboundRecords.some((item) => item.feiTicketNo && item.handoverRecordQrValue),
  '特殊工艺发料或回仓后缺少自动出库记录',
)

const summaryBinding = bindings.find((item) => item.specialCraftFlowStatus === '已回仓') || bindings[0]
assert(summaryBinding, '缺少可统计的特殊工艺菲票绑定')
const orderSummary = getCuttingSpecialCraftReturnStatusByProductionOrder(summaryBinding.productionOrderId)
assert(orderSummary.totalNeedSpecialCraftFeiTickets > 0, '生产单特殊工艺回仓汇总未生成')
assertContains(sewingDispatchSource, 'getEligibleFeiTicketsForSewingDispatch', '裁片发车缝必须依赖特殊工艺回仓可用菲票筛选')
assertContains(sewingDispatchSource, "specialCraftReturnStatus === '已回仓'", '需要特殊工艺的菲票必须已回仓才可进入裁片发料')
assertContains(sewingDispatchSource, '特殊工艺未回仓', '特殊工艺未回仓必须阻断裁片发料')
assertNotContains(sewingDispatchSource, buildToken('特殊工艺', '厂', '直接发', '车', '缝'), '特殊工艺厂不得越过裁床统一发料')
assertContains(progressStatisticsSource, 'getCuttingSpecialCraftReturnStatusByProductionOrder', '统计与进度联动必须消费特殊工艺回仓汇总')
assertContains(progressStatisticsSource, 'specialCraftReturnStatus', '生产进度必须包含特殊工艺回仓状态')
assertContains(progressStatisticsSource, '特殊工艺未回仓', '特殊工艺未回仓必须进入阻塞原因')

console.log('check:cutting-special-craft-dispatch-return passed')
