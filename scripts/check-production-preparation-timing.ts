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

function markedSectionHtml(html: string, marker: string): string {
  const start = html.indexOf(marker)
  assert.ok(start >= 0, `HTML 缺少 ${marker}`)
  const end = html.indexOf('</section>', start)
  assert.ok(end > start, `${marker} section 未闭合`)
  return html.slice(start, end)
}

function detailDrawerHtml(html: string, recordNo: string): string {
  const asideStart = html.indexOf('<aside')
  assert.ok(asideStart >= 0, '详情抽屉未找到起始标签')
  const asideEnd = html.indexOf('</aside>', asideStart)
  assert.ok(asideEnd > asideStart, '详情抽屉未找到结束标签')
  const drawer = html.slice(asideStart, asideEnd + '</aside>'.length)
  assert.ok(drawer.includes(recordNo), `详情抽屉不是 ${recordNo}`)
  return drawer
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

const expectedPrepTypes = [
  '非烫画&非毛织（纯梭织）',
  '烫画&直喷',
  '毛织',
  '毛织&梭织',
] as const

for (const type of expectedPrepTypes) {
  assert.ok(
    productionPreparationRecords.some(
      (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === type,
    ),
    `缺少商品准备类型：${type}`,
  )
}

assert.ok(
  productionPreparationRecords.every(
    (record: {
      selectionName?: string
      largeGoodsThresholdQty?: number
      largeGoodsReachedQty?: number
      largeGoodsReachedAt?: string
      largeGoodsReachedDays?: number
      derivedProductPrepType?: string
      confirmedProductPrepType?: string
      prepTypeSource?: string
      prepTypeConfirmedBy?: string
      prepTypeConfirmedAt?: string
    }) =>
      record.selectionName &&
      record.largeGoodsThresholdQty === 300 &&
      typeof record.largeGoodsReachedQty === 'number' &&
      Boolean(record.largeGoodsReachedAt) &&
      typeof record.largeGoodsReachedDays === 'number' &&
      Boolean(record.derivedProductPrepType) &&
      Boolean(record.confirmedProductPrepType) &&
      Boolean(record.prepTypeSource) &&
      Boolean(record.prepTypeConfirmedBy) &&
      Boolean(record.prepTypeConfirmedAt),
  ),
  '每条记录必须包含选品、做大货入口字段和商品类型确认字段',
)

const overriddenRecord = productionPreparationRecords.find(
  (record: { prepTypeSource?: string }) => record.prepTypeSource === '人工修正',
) as { prepTypeOverrideReason?: string } | undefined
assert.ok(overriddenRecord, '必须有一条商品准备类型人工修正 mock')
assert.ok(
  overriddenRecord.prepTypeOverrideReason,
  '人工修正商品准备类型必须填写修正原因',
)

function itemNames(record: {
  items: Array<{ itemType: string; requiredKind?: string; selectedByMerchandiser?: boolean }>
}): string[] {
  return record.items
    .filter((item) => item.selectedByMerchandiser !== false)
    .map((item) => item.itemType)
}

function assertRecordHasItems(
  record: { recordNo: string; items: Array<{ itemType: string; requiredKind?: string; selectedByMerchandiser?: boolean }> },
  expected: string[],
): void {
  const actual = itemNames(record)
  for (const itemType of expected) {
    assert.ok(actual.includes(itemType), `${record.recordNo} 缺少准备项 ${itemType}`)
  }
}

const wovenRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '非烫画&非毛织（纯梭织）',
)
const printRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '烫画&直喷',
)
const knitRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '毛织',
)
const mixedRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '毛织&梭织',
)

assert.ok(wovenRecord, '缺少纯梭织记录')
assert.ok(printRecord, '缺少烫画&直喷记录')
assert.ok(knitRecord, '缺少毛织记录')
assert.ok(mixedRecord, '缺少毛织&梭织记录')

assertRecordHasItems(wovenRecord, ['梭织基码纸样', '版衣制作', '梭织齐码纸样', '辅料下单'])
assert.deepEqual(itemNames(printRecord), ['数码印/DTF/DTG花型'], '烫画&直喷应有且仅有花型必做项')
assertRecordHasItems(knitRecord, ['毛织基码纸样', '版衣制作', '毛织齐码纸样', '辅料下单'])
assertRecordHasItems(mixedRecord, [
  '毛织基码纸样',
  '梭织基码纸样',
  '版衣制作',
  '毛织齐码纸样',
  '梭织齐码纸样',
  '辅料下单',
])

assert.ok(
  preparationItems.some(
    (item: { requiredKind?: string; selectedByMerchandiser?: boolean }) =>
      item.requiredKind === '选填' && item.selectedByMerchandiser === false,
  ),
  '必须存在未选择的选填准备项',
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
const patternOnlyDetails = buildMonthlyPreparationCompletionDetails('2026-03', { itemType: '花型' })
assert.ok(patternOnlyDetails.length > 0, '2026-03 花型完成明细必须有数据')
assert.ok(
  patternOnlyDetails.every((row: { itemType: string }) => row.itemType === '花型'),
  '按准备项类型筛选月度统计时，完成明细只能包含该准备项',
)
const patternTeamOnlyDetails = buildMonthlyPreparationCompletionDetails('2026-03', { ownerTeam: '花型团队' })
assert.ok(patternTeamOnlyDetails.length > 0, '2026-03 花型团队完成明细必须有数据')
assert.ok(
  patternTeamOnlyDetails.every((row: { ownerTeam: string }) => row.ownerTeam === '花型团队'),
  '按责任团队筛选月度统计时，完成明细只能包含该责任团队',
)
const designerOnlyDetails = buildMonthlyPreparationCompletionDetails('2026-03', { patternDesigner: '冰冰' })
assert.ok(designerOnlyDetails.length > 0, '2026-03 冰冰完成明细必须有数据')
assert.ok(
  designerOnlyDetails.every(
    (row: { itemType: string; patternDesignerName?: string }) =>
      row.itemType === '花型' && row.patternDesignerName === '冰冰',
  ),
  '按花型师筛选月度统计时，完成明细只能包含该花型师的花型项',
)

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
const adjustedLedgerHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03')
for (const text of [
  '做大货阈值：300',
  '达到做大货要求',
  '商品类型',
  '系统推导',
  '跟单确认',
  '准备项确认',
  '预计产出',
] as const) {
  assertHtmlIncludes(adjustedLedgerHtml, text, `调整后准备台账 HTML 缺少「${text}」`)
}

const readyOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-003')
assertHtmlIncludes(readyOutputHtml, '正式产出', '全部完成记录必须展示正式产出')
assertHtmlIncludes(readyOutputHtml, '已生成', '全部完成记录的产出状态必须为已生成')

const pendingOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001')
const pendingOutputDrawerHtml = detailDrawerHtml(pendingOutputHtml, 'PREP-202603-001')
assertHtmlIncludes(pendingOutputDrawerHtml, '预计产出', '未全部完成记录必须只展示预计产出')
assert.ok(!pendingOutputDrawerHtml.includes('正式产出'), '未全部完成记录不应展示正式产出')

const unselectedOptionalRecord = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202603-001',
) as
  | {
      items: Array<{
        itemType?: string
        requiredKind?: string
        selectedByMerchandiser?: boolean
      }>
    }
  | undefined
assert.ok(unselectedOptionalRecord, '缺少 PREP-202603-001 未选择选填项源记录')
const unselectedOptionalItem = unselectedOptionalRecord.items.find((item) => item.itemType === '染色调色（面料）')
assert.ok(unselectedOptionalItem, 'PREP-202603-001 缺少染色调色（面料）选填准备项')
assert.equal(unselectedOptionalItem.requiredKind, '选填', '染色调色（面料）必须是选填准备项')
assert.equal(unselectedOptionalItem.selectedByMerchandiser, false, '染色调色（面料）必须是未选择选填项')
assert.ok(
  !marchDetails.some(
    (row: { recordNo?: string; itemType?: string }) =>
      row.recordNo === 'PREP-202603-001' && row.itemType === '染色调色（面料）',
  ),
  '未选择的选填项不应进入月度完成明细',
)

const assignedLedgerHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordId=prep-202604-003&itemId=prep-202604-003-item-04&action=assign&mockAssignedDesigner=林小美',
)
assertHtmlIncludes(assignedLedgerHtml, '花型师：</span>林小美', '花型师模拟分配后，准备项卡片必须显示新花型师')
const assignedDesignerHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&patternDesigner=林小美&recordId=prep-202604-003&itemId=prep-202604-003-item-04&mockAssignedDesigner=林小美',
)
assertHtmlIncludes(
  assignedDesignerHtml,
  'PREP-202604-003',
  '花型师模拟分配后，按该花型师筛选必须能命中对应任务',
)
const filteredRowActionHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003"',
  '筛选列表行的查看详情入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-04#prep-items"',
  '筛选列表行的更新准备项入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-04&amp;action=assign"',
  '筛选列表行的分配花型师入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-04&amp;action=upload"',
  '筛选列表行的上传完成图片入口必须继承当前筛选条件',
)
const filteredDetailActionHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003',
)
assertHtmlIncludes(
  filteredDetailActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-04&amp;action=assign"',
  '详情抽屉内花型卡片的分配花型师入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredDetailActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-04&amp;action=upload"',
  '详情抽屉内花型卡片的上传完成图片入口必须继承当前筛选条件',
)
const filteredAssignScope = markedSectionHtml(
  await renderAt(
    '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003&itemId=prep-202604-003-item-04&action=assign',
  ),
  'data-pattern-assign-scope',
)
assertHtmlIncludes(
  filteredAssignScope,
  '<input type="hidden" name="recordStatus" value="进行中" />',
  '确认分配提交 scope 必须保留记录状态筛选',
)
assertHtmlIncludes(
  filteredAssignScope,
  '<input type="hidden" name="patternDesigner" value="Diah" />',
  '确认分配提交 scope 必须保留花型师筛选',
)
const filteredUploadScope = markedSectionHtml(
  await renderAt(
    '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003&itemId=prep-202604-003-item-04&action=upload',
  ),
  'data-pattern-upload-scope',
)
assertHtmlIncludes(
  filteredUploadScope,
  '<input type="hidden" name="recordStatus" value="进行中" />',
  '提交完成资料 scope 必须保留记录状态筛选',
)
assertHtmlIncludes(
  filteredUploadScope,
  '<input type="hidden" name="patternDesigner" value="Diah" />',
  '提交完成资料 scope 必须保留花型师筛选',
)
const uploadLedgerHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&recordId=prep-202603-001&itemId=prep-202603-001-item-04&action=upload&mockCompletionUploaded=1&buyerReviewStatus=待确认',
)
assertHtmlIncludes(uploadLedgerHtml, '已模拟提交完成资料', '上传完成图片提交后必须有页面反馈')
assertHtmlIncludes(uploadLedgerHtml, '完成图：</span>2 张', '上传完成图片提交后必须更新完成图数量展示')
assertHtmlIncludes(uploadLedgerHtml, '买手确认：</span>待确认', '上传完成图片提交后必须更新买手确认状态展示')
const uploadPanelHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&recordId=prep-202604-003&itemId=prep-202604-003-item-04&action=upload',
)
const uploadPanelScope = markedSectionHtml(uploadPanelHtml, 'data-pattern-upload-scope')
assertHtmlIncludes(
  uploadPanelScope,
  '<option value="待确认" selected>待确认</option>',
  '上传完成图片面板默认提交状态必须是待确认',
)
assertHtmlIncludes(uploadPanelScope, '>待确认</span>', '上传完成图片面板状态标识默认必须是待确认')
assert.ok(!uploadPanelScope.includes('<option value="未提交"'), '上传完成图片提交选择框不应允许未提交')
assert.ok(!uploadPanelScope.includes('>未提交</span>'), '上传完成图片面板状态标识不应显示未提交')
assert.ok(
  !uploadPanelHtml.includes('买手确认：</span>未提交'),
  '打开上传完成图片流程时，同一抽屉内花型卡片不应继续显示买手确认未提交',
)
const staleUploadStatusHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&recordId=prep-202604-003&itemId=prep-202604-003-item-04&action=upload&mockCompletionUploaded=1&buyerReviewStatus=未提交',
)
assertHtmlIncludes(
  staleUploadStatusHtml,
  '买手确认：</span>待确认',
  '上传完成图片提交后即使旧参数传入未提交，也必须归一为待确认',
)
const detailWithFiltersHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&recordId=prep-202604-001',
)
assertHtmlIncludes(
  detailWithFiltersHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD"',
  '详情抽屉关闭必须保留当前月份和筛选条件',
)
assertHtmlIncludes(
  detailWithFiltersHtml,
  'data-nav="/fcs/production/orders/PO-202604-001/tech-pack"',
  '正式技术包关联对象必须跳转到真实生产单技术包路由',
)

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
