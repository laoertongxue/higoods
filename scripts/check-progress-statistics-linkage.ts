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
import { productionOrders } from '../src/data/fcs/production-orders.ts'

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
const productionDetailSource = read('src/pages/production/detail-domain.ts')
const cuttingProgressSource = read('src/pages/process-factory/cutting/production-progress.ts')
const cuttingSummarySource = read('src/pages/process-factory/cutting/cutting-summary.ts')
const specialCraftStatisticsSource = read('src/pages/process-factory/special-craft/statistics.ts')
const factoryWarehouseSource = read('src/pages/factory-internal-warehouse.ts')
const mobileWarehouseSource = read('src/pages/pda-warehouse-shared.ts') + read('src/data/fcs/factory-mobile-warehouse.ts')
const sewingDispatchSource = read('src/pages/process-factory/cutting/sewing-dispatch.ts')
const routeSource = read('src/router/routes-fcs.ts') + read('src/router/route-renderers-fcs.ts')

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

;[
  '待发料菲票',
  '已发料菲票',
  '已接收菲票',
  '待回仓菲票',
  '已回仓菲票',
  '差异菲票',
  '异议中菲票',
  '状态分布',
].forEach((token) => assertContains(specialCraftStatisticsSource, token, `特殊工艺统计缺少：${token}`))

;[
  '待加工数量',
  '待交出数量',
  '今日入库',
  '今日出库',
  '入库差异',
  '出库差异',
  '盘点差异',
  '超时未处理',
  '异议中',
].forEach((token) => assertContains(factoryWarehouseSource + mobileWarehouseSource, token, `仓库统计缺少：${token}`))

;[
  '裁片发料进度',
  '是否阻塞生产单',
  '中转袋未配齐时不可交出',
].forEach((token) => assertContains(sewingDispatchSource, token, `裁片发料页面缺少进度联动：${token}`))

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
assertNoTokens(scopedSource, ['echarts', 'chart.js', 'recharts'], '统计联动不得新增图表库')
assertNoTokens(scopedSource, ['axios', 'fetch(', 'apiClient', '/api/', 'i18n', 'useTranslation', 'locales', 'translations'], '统计联动不得新增接口或多语言')
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
