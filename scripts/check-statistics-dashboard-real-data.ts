import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  getDyeingDashboardMetrics,
  getDyeingExecutionStatistics,
  getPostFinishingDashboardMetrics,
  getPostFinishingExecutionStatistics,
  getPrintingDashboardMetrics,
  getPrintingExecutionStatistics,
  getSpecialCraftDashboardMetrics,
  getSpecialCraftExecutionStatistics,
} from '../src/data/fcs/process-statistics-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`统计与大屏真实执行数据检查失败：${message}`)
  }
}

function assertIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) {
    assert(source.includes(needle), `${path} 缺少 ${needle}`)
  }
}

const domainPath = 'src/data/fcs/process-statistics-domain.ts'
assert(existsSync(join(root, domainPath)), '缺少统一统计派生层')
assertIncludes(domainPath, [
  'getPrintingExecutionStatistics',
  'getPrintingDashboardMetrics',
  'getDyeingExecutionStatistics',
  'getDyeingDashboardMetrics',
  'getSpecialCraftExecutionStatistics',
  'getSpecialCraftDashboardMetrics',
  'getPostFinishingExecutionStatistics',
  'getPostFinishingDashboardMetrics',
  'sumWarehouseQty',
  'sumHandoverQty',
  'countByStatus',
  'countByCraftType',
  'countByFactory',
  'countByCurrentAction',
  'calcDiffRate',
  'calcCompletionRate',
  'calcAverageDuration',
  'calcOverdueCount',
  'listProcessWorkOrders',
  'listWaitProcessWarehouseRecords',
  'listWaitHandoverWarehouseRecords',
  'listProcessHandoverRecords',
  'listProcessHandoverDifferenceRecords',
  'listProcessWarehouseReviewRecords',
])

assertIncludes('src/pages/process-factory/printing/statistics.ts', [
  'getPrintingExecutionStatistics',
  '印花统计',
  '计划印花面料米数',
  '打印完成面料米数',
  '转印完成面料米数',
  '差异面料米数',
])
assertIncludes('src/pages/process-factory/printing/dashboards.ts', [
  'getPrintingDashboardMetrics',
  '印花大屏',
  '今日待打印面料米数',
  '按状态维度的印花加工单分布',
  '按工厂维度的印花执行进度',
])
assertIncludes('src/pages/process-factory/dyeing/reports.ts', [
  'getDyeingExecutionStatistics',
  '染色统计',
  '计划染色面料米数',
  '染色完成面料米数',
  '包装完成面料米数',
  '差异面料米数',
])
assertIncludes('src/pages/process-factory/dyeing/work-order-detail.ts', [
  'getDyeingExecutionStatistics',
  '染色统计',
  '包装完成面料米数',
  '差异面料米数',
])
assertIncludes('src/pages/process-factory/special-craft/statistics.ts', [
  'getSpecialCraftExecutionStatistics',
  '特殊工艺单总数',
  '待加工裁片数量',
  '加工完成裁片数量',
  '当前裁片数量',
  '累计报废裁片数量',
  '累计货损裁片数量',
  '关联菲票数量',
])
assertIncludes('src/pages/process-factory/post-finishing/statistics.ts', [
  'getPostFinishingExecutionStatistics',
  '后道统计',
  '待后道成衣件数',
  '质检通过成衣件数',
  '复检确认成衣件数',
  '已交出成衣件数',
  '差异成衣件数',
])

const printStats = getPrintingExecutionStatistics()
const dyeStats = getDyeingExecutionStatistics()
const specialStats = getSpecialCraftExecutionStatistics()
const postStats = getPostFinishingExecutionStatistics()
assert(printStats.workOrderCount >= 12, '印花加工单统计样本少于 12 条')
assert(printStats.printCompletedFabricMeters > 0 && printStats.transferCompletedFabricMeters > 0, '印花执行节点未纳入统计')
assert(printStats.waitHandoverRecordCount >= 3 && printStats.differenceRecordCount >= 3, '印花仓记录或差异记录样本不足')
assert(getPrintingDashboardMetrics().statusRows.length > 0, '印花大屏状态分布为空')

assert(dyeStats.workOrderCount >= 12, '染色加工单统计样本少于 12 条')
assert(dyeStats.dyeCompletedFabricMeters > 0 && dyeStats.finalPackedFabricMeters > 0, '染色执行节点未纳入统计')
assert(dyeStats.waitHandoverRecordCount >= 3 && dyeStats.differenceRecordCount >= 3, '染色仓记录或差异记录样本不足')
assert(getDyeingDashboardMetrics().statusRows.length > 0, '染色大屏指标为空')

assert(specialStats.taskOrderCount >= 18, '特殊工艺任务样本不足')
assert(specialStats.feiTicketCount >= 12, '特殊工艺菲票未纳入统计')
assert(specialStats.diffPieceQty >= 0 && specialStats.scrapPieceQty >= 0 && specialStats.damagePieceQty >= 0, '特殊工艺差异数量未纳入统计')
assert(getSpecialCraftDashboardMetrics().statusRows.length > 0, '特殊工艺大屏派生指标为空')

assert(postStats.postOrderCount >= 12, '后道单统计样本少于 12 条')
assert(postStats.qcPassGarmentQty > 0 && postStats.recheckConfirmedGarmentQty > 0, '后道质检/复检记录未纳入统计')
assert(postStats.waitHandoverGarmentQty > 0 && postStats.differenceRecordCount >= 3, '后道交出仓或差异记录未纳入统计')
assert(getPostFinishingDashboardMetrics().statusRows.length > 0, '后道大屏派生指标为空')

const pagesWithPotentialMocks = [
  'src/pages/process-factory/printing/statistics.ts',
  'src/pages/process-factory/printing/dashboards.ts',
  'src/pages/process-factory/dyeing/reports.ts',
  'src/pages/process-factory/special-craft/statistics.ts',
  'src/pages/process-factory/post-finishing/statistics.ts',
].map(read).join('\n')
assert(!/const\s+\w*Statistics\w*\s*=\s*\[/.test(pagesWithPotentialMocks), '统计页面不得维护孤立统计数组')
assert(!/const\s+\w*Dashboard\w*\s*=\s*\[/.test(pagesWithPotentialMocks), '大屏页面不得维护孤立大屏数组')
assert(!pagesWithPotentialMocks.includes('mockStatistics'), '统计页面不得引用 mockStatistics')
assert(!pagesWithPotentialMocks.includes('mockDashboard'), '大屏页面不得引用 mockDashboard')

const dyeOldWord = '染色' + '报表'
const visibleSources = [
  'src/pages/process-factory/dyeing/reports.ts',
  'src/pages/process-factory/dyeing/work-order-detail.ts',
  'src/data/app-shell-config.ts',
  'src/router/routes-fcs.ts',
].map(read).join('\n')
assert(!visibleSources.includes(dyeOldWord), '用户可见文案不得出现旧染色报表命名')

const postStatsSource = [
  'src/pages/process-factory/post-finishing/statistics.ts',
  domainPath,
].map(read).join('\n')
for (const forbidden of ['开扣眼', '装扣子', '熨烫']) {
  assert(!postStatsSource.includes(forbidden), `后道统计和大屏不得出现 ${forbidden} 作为任务动作`)
}
assert(!postStatsSource.includes('包装'), '后道统计和大屏不得出现包装作为任务动作')

const quantityLabelSource = pagesWithPotentialMocks
assert(!/>\s*数量：/.test(quantityLabelSource), '统计和大屏不得只显示“数量：”')
for (const requiredLabel of [
  '计划印花面料米数',
  '交出裁片数量',
  '复检确认成衣件数',
]) {
  assert(quantityLabelSource.includes(requiredLabel), `统计页面缺少对象化数量文案：${requiredLabel}`)
}

const statisticDomainSource = read(domainPath)
for (const forbidden of ['质量扣款流水', '对账流水', '结算流水']) {
  assert(!statisticDomainSource.includes(forbidden), `统计逻辑不得直接生成${forbidden}`)
}

for (const route of [
  '/fcs/craft/printing/statistics',
  '/fcs/craft/printing/dashboards',
  '/fcs/craft/dyeing/reports',
  '/fcs/craft/post-finishing/statistics',
]) {
  assert(read('src/router/routes-fcs.ts').includes(route), `缺少统计或大屏路由：${route}`)
}
assert(
  read('src/router/routes-fcs.ts').includes('buildSpecialCraftStatisticsPath(operation)') &&
    read('src/router/routes-fcs.ts').includes('renderSpecialCraftStatisticsPage(operationSlug)'),
  '缺少特殊工艺统计路由生成逻辑',
)

assert(existsSync(join(root, 'docs/fcs-statistics-dashboard-real-data.md')), '缺少统计与大屏真实取数文档')

console.log('统计与大屏真实执行数据检查通过')
