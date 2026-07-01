#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function source(path: string): string {
  assert.ok(existsSync(path), `${path} 不存在`)
  return readFileSync(path, 'utf8')
}

function assertIncludes(path: string, text: string, message: string): void {
  assert.ok(source(path).includes(text), message)
}

function assertHtmlIncludes(html: string, text: string, message: string): void {
  assert.ok(html.includes(text), message)
}

function getCompletedItemCount(items: Array<{ status: string }>): number {
  return items.filter((item) => item.status === '已完成').length
}

function getOverdueItemCount(items: Array<{ status: string; overdueHours: number }>): number {
  return items.filter((item) => item.status === '已超时' || item.overdueHours > 0).length
}

function getCompletedCount(stats: Array<{ itemType: string; completedCount: number }>, itemType: string): number {
  const row = stats.find((item) => item.itemType === itemType)
  assert.ok(row, `2026-03 统计缺少${itemType}`)
  return row.completedCount
}

for (const file of [
  'src/data/fcs/production-preparation-timing.ts',
  'src/pages/production/preparation-timing.ts',
  'src/data/app-shell-config.ts',
  'src/router/routes-fcs.ts',
  'src/router/route-renderers-fcs.ts',
  'src/router/route-renderers.ts',
] as const) {
  assert.ok(existsSync(file), `${file} 不存在`)
}

const menuSource = source('src/data/app-shell-config.ts')
const productionMenuStart = menuSource.indexOf("key: 'fcs-platform-production'")
assert.ok(productionMenuStart >= 0, '菜单缺少生产单管理分组')
const productionMenuEnd = menuSource.indexOf("key: 'fcs-platform-process'", productionMenuStart)
assert.ok(productionMenuEnd >= 0, '菜单缺少工艺平台分组')
const productionMenu = menuSource.slice(productionMenuStart, productionMenuEnd)
assert.ok(productionMenu.includes('production-preparation-timing'), '生产单管理菜单缺少生产准备时效')
assert.ok(productionMenu.includes('/fcs/production/preparation-timing'), '生产准备时效 href 不正确')
const planIndex = productionMenu.indexOf('production-plan')
const timingIndex = productionMenu.indexOf('production-preparation-timing')
const warehouseIndex = productionMenu.indexOf('production-delivery-warehouse')
assert.ok(planIndex >= 0, '生产单管理菜单缺少生产单计划')
assert.ok(timingIndex >= 0, '生产单管理菜单缺少生产准备时效')
assert.ok(warehouseIndex >= 0, '生产单管理菜单缺少交付仓配置')
assert.ok(
  planIndex < timingIndex && timingIndex < warehouseIndex,
  '生产准备时效必须位于生产单计划之后、交付仓配置之前',
)

assertIncludes('src/router/routes-fcs.ts', '/fcs/production/preparation-timing', 'routes-fcs.ts 缺少生产准备时效路由')
assertIncludes('src/router/routes-fcs.ts', 'renderProductionPreparationTimingPage', 'routes-fcs.ts 缺少生产准备时效 renderer')
assertIncludes(
  'src/router/route-renderers-fcs.ts',
  'renderProductionPreparationTimingPage',
  'route-renderers-fcs.ts 缺少生产准备时效 renderer',
)
assertIncludes(
  'src/router/route-renderers.ts',
  'renderProductionPreparationTimingPage',
  'route-renderers.ts 缺少生产准备时效 renderer',
)

const {
  buildMonthlyPreparationCompletionDetails,
  buildMonthlyPreparationStats,
  filterProductionPreparationRecords,
  flattenProductionPreparationItems,
  productionPreparationRecords,
} = await import('../src/data/fcs/production-preparation-timing.ts')

assert.ok(Array.isArray(productionPreparationRecords), 'productionPreparationRecords 必须是数组')
assert.ok(productionPreparationRecords.length >= 12, 'productionPreparationRecords 不少于 12 条')

const preparationItems = flattenProductionPreparationItems(productionPreparationRecords)
assert.ok(Array.isArray(preparationItems), 'flattenProductionPreparationItems 必须返回数组')
assert.ok(preparationItems.length >= 70, '准备项不少于 70 条')
assert.ok(getCompletedItemCount(preparationItems) >= 24, '已完成准备项不少于 24 条')
assert.ok(getOverdueItemCount(preparationItems) >= 8, '超时准备项不少于 8 条')
assert.ok(preparationItems.filter((item: { itemType: string }) => item.itemType === '花型').length >= 6, '花型不少于 6 条')
assert.ok(
  preparationItems.filter((item: { itemType: string }) => item.itemType === '染色调色').length >= 5,
  '染色调色不少于 5 条',
)
assert.ok(
  preparationItems.filter((item: { itemType: string }) => item.itemType === '毛织纸样').length >= 3,
  '毛织纸样不少于 3 条',
)

const marchStats = buildMonthlyPreparationStats('2026-03')
assert.ok(Array.isArray(marchStats), 'buildMonthlyPreparationStats 必须返回数组')
const marchDetails = buildMonthlyPreparationCompletionDetails('2026-03')
assert.ok(Array.isArray(marchDetails), 'buildMonthlyPreparationCompletionDetails 必须返回数组')
const marchCompletedCount = marchStats.reduce(
  (sum: number, row: { completedCount: number }) => sum + row.completedCount,
  0,
)
assert.equal(
  marchCompletedCount,
  marchDetails.length,
  '2026-03 completedCount 总和必须等于完成明细行数',
)
for (const itemType of ['基码纸样', '齐码纸样', '花型', '染色调色'] as const) {
  assert.ok(getCompletedCount(marchStats, itemType) > 0, `2026-03 ${itemType}完成数量必须大于 0`)
}
assert.ok(
  marchDetails.every((row: { recordStatus?: string }) => row.recordStatus !== '已关闭'),
  '完成明细不应包含已关闭记录',
)
assert.ok(
  marchDetails.every((row: { required?: boolean }) => row.required === true),
  '完成明细每行 required 必须为 true',
)
assert.ok(
  marchDetails.every((row: { itemStatus?: string }) => row.itemStatus === '已完成'),
  '完成明细每行 itemStatus 必须为已完成',
)
const patternDesignerRecords = filterProductionPreparationRecords({
  itemType: '花型',
  patternDesigner: '林小美',
})
assert.ok(Array.isArray(patternDesignerRecords), 'filterProductionPreparationRecords 必须返回数组')
assert.ok(patternDesignerRecords.length > 0, '花型师林小美必须能命中花型数据')

const pageModule = await import('../src/pages/production/preparation-timing.ts')
const renderProductionPreparationTimingPage = pageModule.renderProductionPreparationTimingPage as
  | ((path?: string) => string | Promise<string>)
  | undefined
assert.equal(typeof renderProductionPreparationTimingPage, 'function', '页面必须导出 renderProductionPreparationTimingPage')

const { appStore } = await import('../src/state/store.ts')
async function renderAt(path: string): Promise<string> {
  appStore.navigate(path, { historyMode: 'replace' })
  const html = await renderProductionPreparationTimingPage(path)
  assert.equal(typeof html, 'string', 'renderProductionPreparationTimingPage 必须返回 HTML 字符串')
  return html
}

const ledgerHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&patternDesigner=林小美')
for (const text of [
  '生产准备时效',
  '准备台账',
  '月度统计',
  '统计口径：生产准备记录 + 准备项 = 1',
  '花型师',
  '我的花型任务',
  '待上传完成图',
  '待买手确认',
  '分配花型师',
  '上传完成图片',
] as const) {
  assertHtmlIncludes(ledgerHtml, text, `准备台账 HTML 缺少「${text}」`)
}

const statsHtml = await renderAt('/fcs/production/preparation-timing?tab=stats&month=2026-03')
appStore.navigate('/fcs/production/preparation-timing?tab=stats&month=2026-03', { historyMode: 'replace' })
const routedStatsHtml = await renderProductionPreparationTimingPage()
assert.equal(typeof routedStatsHtml, 'string', '无参数渲染必须返回 HTML 字符串')
assertHtmlIncludes(routedStatsHtml, '导出月度统计', '无参数渲染必须读取当前路由并显示月度统计')
for (const text of [
  '导出月度统计',
  '导出完成明细',
  '完成基码',
  '完成齐码',
  '完成花型',
  '完成染色',
  '完成数量',
  '按时完成数量',
  '超时完成数量',
  '平均耗时小时',
  '生产准备时效月度统计-202603.csv',
  '生产准备时效完成明细-202603.csv',
  'data:text/csv;charset=utf-8',
] as const) {
  assertHtmlIncludes(statsHtml, text, `月度统计 HTML 缺少「${text}」`)
}

for (const statusCode of ['PENDING', 'DONE', 'IN_PROGRESS', 'CANCELLED', 'ON_HOLD'] as const) {
  assert.ok(!ledgerHtml.includes(statusCode), `准备台账 HTML 不得包含英文状态码 ${statusCode}`)
  assert.ok(!statsHtml.includes(statusCode), `月度统计 HTML 不得包含英文状态码 ${statusCode}`)
}

console.log('production preparation timing checks passed')
