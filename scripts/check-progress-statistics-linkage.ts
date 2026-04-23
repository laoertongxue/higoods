#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertProgressStatisticsConsistency,
  buildFactoryWarehouseProgressSnapshots,
  buildHandoverProgressSnapshot,
  buildProductionProgressKpiSummary,
  buildProductionProgressSnapshot,
  buildProgressBlockingReasons,
  buildSewingDispatchProgressSnapshot,
  buildSpecialCraftProgressSnapshots,
  getCuttingProgressSnapshots,
  getFactoryWarehouseProgressSnapshots,
  getProductionProgressSnapshots,
  getProgressStatisticsDashboard,
  getSpecialCraftProgressSnapshots,
} from '../src/data/fcs/progress-statistics-linkage.ts'
import { listBusinessFactoryMasterRecords, listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { TEST_FACTORY_ID } from '../src/data/fcs/factory-mock-data.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getFilteredPoRows, getPoViewRows } from '../src/pages/progress-board/context.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function ensureExists(relativePath: string): void {
  assert(fs.existsSync(path.join(ROOT, relativePath)), `缺少文件：${relativePath}`)
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function joinText(parts: string[]): string {
  return parts.join('')
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

function assertNoTokens(source: string, tokens: string[], messagePrefix: string): void {
  tokens.forEach((token) => {
    assert(!source.includes(token), `${messagePrefix}：${token}`)
  })
}

const packageSource = read('package.json')
const linkageSource = read('src/data/fcs/progress-statistics-linkage.ts')
const progressBoardSource = read('src/pages/progress-board/core.ts')
const progressBoardOrderDomainSource = read('src/pages/progress-board/order-domain.ts')
const productionDetailSource = read('src/pages/production/detail-domain.ts')
const cuttingProgressSource = read('src/pages/process-factory/cutting/production-progress.ts')
const cuttingSummarySource = read('src/pages/process-factory/cutting/cutting-summary.ts')
const specialCraftStatisticsSource = read('src/pages/process-factory/special-craft/statistics.ts')
const factoryWarehouseSource = read('src/pages/factory-internal-warehouse.ts')
const mobileWarehouseSource = read('src/pages/pda-warehouse-shared.ts') + read('src/data/fcs/factory-mobile-warehouse.ts')
const sewingDispatchSource = read('src/pages/process-factory/cutting/sewing-dispatch.ts')
const routeSource = read('src/router/routes-fcs.ts') + read('src/router/route-renderers-fcs.ts')

function normalizeDueDate(value: string): number {
  if (!value) return Number.POSITIVE_INFINITY
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}

function assertRowsSortedByDueDate(rows: Array<{ dueDate?: string; urgencyLevel?: string; productionOrderNo: string }>): void {
  for (let index = 1; index < rows.length; index += 1) {
    const prev = rows[index - 1]
    const current = rows[index]
    const prevDue = normalizeDueDate(prev.dueDate || '')
    const currentDue = normalizeDueDate(current.dueDate || '')
    assert(prevDue <= currentDue, '生产进度默认排序必须按交期升序，缺少交期排最后')
    if (prevDue === currentDue) {
      assert(
        `${prev.productionOrderNo}`.localeCompare(`${current.productionOrderNo}`, 'zh-CN') <= 0
          || `${prev.urgencyLevel || ''}` !== `${current.urgencyLevel || ''}`,
        '交期相同时，生产单号排序必须稳定',
      )
    }
  }
}

ensureExists('src/data/fcs/progress-statistics-linkage.ts')
ensureExists('scripts/check-progress-statistics-linkage.ts')
assertContains(packageSource, 'check:progress-statistics-linkage', 'package.json 缺少统计与进度联动检查命令')

;[
  'ProductionProgressSnapshot',
  'CuttingProgressSnapshot',
  'SpecialCraftProgressSnapshot',
  'FactoryWarehouseProgressSnapshot',
  'HandoverProgressSnapshot',
  'SewingDispatchProgressSnapshot',
  'ProgressBlockingReason',
  'ProductionProgressKpiSummary',
  'buildProductionProgressSnapshot',
  'buildCuttingProgressSnapshot',
  'buildSpecialCraftProgressSnapshots',
  'buildFactoryWarehouseProgressSnapshots',
  'buildHandoverProgressSnapshot',
  'buildSewingDispatchProgressSnapshot',
  'buildProgressBlockingReasons',
  'buildProductionProgressKpiSummary',
  'getProductionProgressSnapshotByOrder',
  'getProgressStatisticsDashboard',
  'assertProgressStatisticsConsistency',
].forEach((token) => assertContains(linkageSource, token, `统计联动数据层缺少：${token}`))

;[
  'production-orders',
  'material-prep',
  'generated-fei-tickets',
  'special-craft-task-orders',
  'special-craft-fei-ticket-flow',
  'sewing-dispatch',
  'pda-handover-events',
  'factory-internal-warehouse',
].forEach((token) => assertContains(linkageSource, token, `统计联动必须消费来源数据：${token}`))
assertContains(linkageSource, 'getCuttingSewingDispatchProgressByProductionOrder', '裁片发车缝统计必须调用 Prompt 8 helper')
assertContains(linkageSource, 'bagWritebackLineCount', '统计联动缺少袋级回写统计')
assertContains(linkageSource, 'feiTicketWritebackLineCount', '统计联动缺少菲票级回写统计')
assertContains(linkageSource, 'partialWrittenBackTransferBagCount', '统计联动缺少中转袋部分回写统计')
assertContains(linkageSource, '统计结果只作为只读投影，不作为状态源头', '统计结果不得作为状态源头')

const sampleOrder = productionOrders[0]
assert(sampleOrder, '缺少生产单样例')
const productionSnapshot = buildProductionProgressSnapshot(sampleOrder)
const sewingSnapshot = buildSewingDispatchProgressSnapshot(sampleOrder)
const handoverSnapshot = buildHandoverProgressSnapshot(sampleOrder)
const blockingReasons = buildProgressBlockingReasons(sampleOrder)
const productionSnapshots = getProductionProgressSnapshots()
const cuttingSnapshots = getCuttingProgressSnapshots()
const specialCraftSnapshots = getSpecialCraftProgressSnapshots()
const factorySnapshots = getFactoryWarehouseProgressSnapshots()
const dashboard = getProgressStatisticsDashboard()
const productionRows = getFilteredPoRows(getPoViewRows())
const defaultBusinessFactories = listBusinessFactoryMasterRecords()
const allFactories = listFactoryMasterRecords()

assert(productionSnapshots.length === productionOrders.length, '生产进度快照数量必须与生产单数量一致')
assert(cuttingSnapshots.length === productionOrders.length, '裁床进度快照数量必须与生产单数量一致')
assert(specialCraftSnapshots.length === buildSpecialCraftProgressSnapshots().length, '特殊工艺统计 helper 输出不一致')
assert(factorySnapshots.length === buildFactoryWarehouseProgressSnapshots().length, '工厂仓库统计 helper 输出不一致')
assert(buildProductionProgressKpiSummary(productionSnapshots).totalProductionOrders === productionOrders.length, '生产进度 KPI 总数必须与生产单一致')
assert(productionSnapshot.blockingReasons.every((item) => item.blockingLabel && item.nextActionLabel), '阻塞原因必须可解释并带下一步')
assert(blockingReasons.every((item) => item.blockingLabel !== '未知原因' && item.blockingLabel !== '其他原因'), '阻塞原因不得使用未知或其他')
assert(sewingSnapshot.cumulativeDispatchedGarmentQty <= sewingSnapshot.totalProductionQty, '累计已发件数不得超过生产总数')
assert(sewingSnapshot.remainingGarmentQty >= 0, '剩余未发件数不得小于 0')
assert(handoverSnapshot.receiverWrittenQty <= handoverSnapshot.submittedQty + handoverSnapshot.receiverWrittenQty, '交接回写统计必须有来源数量')
assert(!factorySnapshots.some((item) => item.factoryName.includes('车缝')), '车缝厂不应进入工厂内部仓统计')
assert(!productionSnapshots.some((item) => (item.specialCraftReturnStatus === '未回仓' || item.specialCraftReturnStatus === '部分回仓') && item.canProceedToSewingDispatch), '特殊工艺未回仓时不可发车缝')
assert(dashboard.kpiSummary.totalProductionOrders === productionOrders.length, '统计看板 KPI 必须与生产单一致')
assertRowsSortedByDueDate(productionRows)
assert(defaultBusinessFactories.every((factory) => !factory.isTestFactory), '默认业务工厂列表必须排除测试工厂')
assert(allFactories.some((factory) => factory.id === TEST_FACTORY_ID && factory.isTestFactory), '测试工厂必须保留在工厂主数据中')
assert(
  !buildFactoryWarehouseProgressSnapshots().some((item) => item.factoryId === TEST_FACTORY_ID),
  '默认工厂仓库统计 builder 必须排除测试工厂',
)
assert(
  buildFactoryWarehouseProgressSnapshots({ includeTestFactories: true }).some((item) => item.factoryId === TEST_FACTORY_ID),
  '显式包含测试工厂时，工厂仓库统计 builder 必须可返回测试工厂',
)
assertProgressStatisticsConsistency()

;[
  '生产进度',
  '进度总览',
  '面料配置',
  '裁床领料',
  '特殊工艺回仓',
  '裁片发料',
  '车缝回写',
  '当前阻塞',
  '下一步',
  '可发车缝',
].forEach((token) => assertContains(progressBoardSource + productionDetailSource, token, `生产进度页面缺少：${token}`))
assertContains(progressBoardSource + progressBoardOrderDomainSource, '默认按交期排序', '生产进度页面缺少默认交期排序提示')
assertContains(linkageSource, 'sortProductionProgressByDefaultDueDate', '统计联动缺少生产进度默认交期排序 helper')
assertContains(linkageSource, 'compareProductionProgressByDefaultDueDate', '统计联动缺少生产进度交期比较 helper')
assertContains(linkageSource, 'includeTestFactories', '统计联动缺少测试工厂排除开关')

;[
  '裁床进度联动',
  '配料进度',
  '领料进度',
  '菲票进度',
  '特殊工艺回仓',
  '裁片发车缝',
  '累计已发车缝件数',
  '剩余未发件数',
  '阻塞原因',
].forEach((token) => assertContains(cuttingProgressSource + cuttingSummarySource, token, `裁床进度或裁剪总结缺少：${token}`))
assertContains(cuttingProgressSource, "viewDimension: 'CUT_ORDER'", '裁床进度默认视图必须是裁片单维度')
assertContains(cuttingProgressSource, "'CUT_ORDER'", '裁床进度缺少裁片单维度配置')
assertContains(cuttingProgressSource, "'PRODUCTION_ORDER'", '裁床进度缺少生产单维度配置')
assertContains(cuttingProgressSource, '裁片单维度', '裁床进度缺少裁片单维度文案')
assertContains(cuttingProgressSource, '生产单维度', '裁床进度缺少生产单维度文案')
assertContains(cuttingProgressSource, '原始裁片单号', '裁床进度缺少裁片单号字段')
assertContains(cuttingProgressSource, '面料 SKU', '裁床进度缺少面料 SKU 字段')
assertContains(cuttingProgressSource, '特殊工艺回仓', '裁床进度缺少特殊工艺回仓字段')
assertContains(cuttingProgressSource, '裁片发料', '裁床进度缺少裁片发料字段')

;[
  '待发料菲票',
  '已发料菲票',
  '已接收菲票',
  '待回仓菲票',
  '已回仓菲票',
  '接收差异菲票',
  '回仓差异菲票',
  '报废数量',
  '货损数量',
  '当前数量',
  '差异菲票',
  '异议中菲票',
  '状态分布',
].forEach((token) => assertContains(specialCraftStatisticsSource, token, `特殊工艺统计缺少：${token}`))
assertContains(linkageSource, "groupBy: '工艺'", '特殊工艺统计必须默认按工艺分组')
assertContains(linkageSource, 'receiveDifferenceTicketCount', '特殊工艺统计必须包含接收差异菲票')
assertContains(linkageSource, 'returnDifferenceTicketCount', '特殊工艺统计必须包含回仓差异菲票')
assertContains(linkageSource, 'scrapQty', '特殊工艺统计必须包含报废数量')
assertContains(linkageSource, 'damageQty', '特殊工艺统计必须包含货损数量')
assertContains(linkageSource, 'currentQty', '特殊工艺统计必须包含当前数量')
assertContains(linkageSource, 'selectedTargetObject', '统计联动必须消费 Step 1 作用对象字段')
assertContains(linkageSource, 'supportedTargetObjects', '统计联动必须消费 Step 1 支持作用对象字段')
assertContains(linkageSource, 'bundleLengthCm', '统计联动必须消费 Step 1 捆条长度字段')
assertContains(linkageSource, 'bundleWidthCm', '统计联动必须消费 Step 1 捆条宽度字段')
assertContains(linkageSource, 'workOrderCount', '统计联动必须消费 Step 2 子工艺单数字段')
assertContains(linkageSource, 'completionStatus', '统计联动必须消费 Step 3 单据完成状态字段')
assertContains(linkageSource, 'receiverClosedAt', '统计联动必须消费 Step 3 接收方关闭字段')
assertContains(linkageSource, 'bagMode', '统计联动必须消费 Step 4 中转袋模式字段')
assertContains(linkageSource, 'contentItemCount', '统计联动必须消费 Step 4 袋内明细数字段')
assertContains(linkageSource, 'combinedWritebackStatus', '统计联动必须消费 Step 4 综合回写状态字段')
assertContains(linkageSource, 'receivedTransferBagCount', '统计联动必须消费 Step 4 已收中转袋字段')
assertContains(linkageSource, 'receivedFeiTicketCount', '统计联动必须消费 Step 4 已收菲票字段')

;[
  '待加工数量',
  '待交出数量',
  '今日入库',
  '今日出库',
  '入库差异',
  '出库差异',
  '盘点差异',
  '待审核差异',
  '已调整',
  '超时未处理',
  '异议中',
].forEach((token) => assertContains(factoryWarehouseSource + mobileWarehouseSource, token, `仓库统计缺少：${token}`))
assertContains(linkageSource, 'stocktakeWaitReviewCount', '统计联动缺少待审核差异计数')
assertContains(linkageSource, 'stocktakeAdjustedCount', '统计联动缺少已调整差异计数')
assertContains(linkageSource, 'pickupCompletedOrderCount', '统计联动缺少已完成领料单计数')
assertContains(linkageSource, 'handoutCompletedOrderCount', '统计联动缺少已完成交出单计数')

;[
  '裁片发料进度',
  '是否阻塞生产单',
  '中转袋未配齐时不可交出',
].forEach((token) => assertContains(sewingDispatchSource, token, `裁片发料页面缺少进度联动：${token}`))
assertContains(linkageSource, 'mixedTransferBagCount', '统计联动缺少混装中转袋统计')
assertContains(linkageSource, 'packedTransferBagCount', '统计联动缺少已装袋中转袋统计')
assertContains(linkageSource, 'scannedReceivedTransferBagCount', '统计联动缺少已扫码接收中转袋统计')
assertContains(linkageSource, 'partialWritebackTransferBagCount', '统计联动缺少部分回写中转袋统计')
assertContains(linkageSource, 'bagDifferenceCount', '统计联动缺少袋级差异统计')
assertContains(linkageSource, 'feiTicketDifferenceCount', '统计联动缺少菲票级差异统计')

assertContains(routeSource, '/fcs/progress/board', '菜单路由缺少生产进度入口')

const scopedSource = [
  linkageSource,
  progressBoardSource,
  productionDetailSource,
  cuttingProgressSource,
  cuttingSummarySource,
  specialCraftStatisticsSource,
  factoryWarehouseSource,
  mobileWarehouseSource,
  sewingDispatchSource,
].join('\n')

assertNoTokens(scopedSource, ['未知原因', '系统异常', '其他原因'], '阻塞原因不得使用不可解释口径')
assertNoTokens(scopedSource, [
  buildToken('auto', 'Schedule'),
  buildToken('smart', 'Schedule'),
  buildToken('schedule', 'Suggestion'),
  joinText(['自动', '排程']),
  joinText(['AI', '排程']),
  joinText(['智能', '调度']),
  joinText(['自动', '派单']),
  joinText(['自动', '改派']),
], '统计联动不得新增排程或派单能力')
assertNoTokens(scopedSource, [buildToken('e', 'charts'), buildToken('chart', '.', 'js'), buildToken('re', 'charts')], '统计联动不得新增图表库')
assertNoTokens(scopedSource, [
  buildToken('axi', 'os'),
  buildToken('fet', 'ch('),
  buildToken('api', 'Client'),
  buildToken('/', 'api', '/'),
  buildToken('i1', '8n'),
  buildToken('use', 'Translation'),
  buildToken('loc', 'ales'),
  buildToken('trans', 'lations'),
], '统计联动不得新增接口或多语言')
assertNoTokens(scopedSource, [
  joinText(['库存', '三态']),
  buildToken('available', 'Stock'),
  buildToken('occupied', 'Stock'),
  buildToken('inTransit', 'Stock'),
  joinText(['上架', '任务']),
  joinText(['拣货', '波次']),
  joinText(['拣货', '路径']),
  joinText(['库位', '规则']),
  joinText(['完整', '库存账']),
], '统计联动不得扩展完整仓储能力')
assertNoTokens(scopedSource, [buildToken('PD', 'A'), joinText(['来', '料仓']), joinText(['半成品', '仓']), 'QR payload', 'JSON.stringify'], '统计联动页面不得出现旧文案或原始二维码内容')

console.log('check:progress-statistics-linkage passed')
